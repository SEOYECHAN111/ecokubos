
from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path
import os, time, secrets, re
BASE=Path(__file__).parent; STATIC=BASE/'static'; PROTECTED=BASE/'protected'/'forms'
app=FastAPI(title='자원잇다 Visual Icon Polished API',version='28.0')
TOKENS={
 'demo-admin':{'role':'admin','plan':'Admin','status':'approved','name':'관리자','displayName':'관리자님'},
 'demo-personal':{'role':'personal','plan':'Free','status':'approved','name':'김예찬','displayName':'김예찬님'},
 'demo-partner':{'role':'partner','plan':'Gold','status':'approved','name':'광주그린자원','displayName':'광주그린자원님'},
 'demo-agency':{'role':'agency','plan':'Pro','status':'approved','name':'광주광역시청','displayName':'광주광역시청님'},
 'demo-enterprise':{'role':'enterprise','plan':'ESG Plus','status':'approved','name':'삼성전자','displayName':'삼성전자님'},
}
FORM_ACCESS={
 'pre':('01_pre_onbid_forms.pdf',['agency','admin'],['Basic','Standard','Pro','Enterprise','Admin']),
 'attach':('02_onbid_attachments.pdf',['agency','admin'],['Basic','Standard','Pro','Enterprise','Admin']),
 'joint':('03_joint_proxy_bid.pdf',['partner','admin'],['Standard','Plus','Gold','Admin']),
 'internal':('04_internal_reports.pdf',['agency','admin'],['Standard','Pro','Enterprise','Admin']),
 'room':('05_participation_room.pdf',['partner','agency','admin'],['Basic','Standard','Plus','Gold','Pro','Enterprise','Admin']),
 'workbid':('06_internal_work_bid.pdf',['partner','enterprise','admin'],['Basic','Standard','Plus','Gold','ESG Plus','Enterprise','Admin']),
 'post':('07_post_award_management.pdf',['partner','agency','admin'],['Plus','Gold','Pro','Enterprise','Admin']),
 'report':('08_resource_performance.pdf',['enterprise','agency','admin'],['Standard','ESG Plus','Pro','Enterprise','Admin']),
 'audit':('09_admin_audit.pdf',['admin'],['Admin']),
}
INQUIRIES=[]
class Login(BaseModel):
    id:str; password:str
class Signup(BaseModel):
    role:str; name:str|None=None; phone:str|None=None; memo:str|None=None
class PickupEligibility(BaseModel):
    item:str|None=None; weight:float=0; value:float=0; count:int=0; bulky:bool=False
class Intake(BaseModel):
    role:str='agency'; organization:str|None=None; purpose:str|None=None; items:str|None=None; location:str|None=None; dates:str|None=None; amount:str|None=None
class RouteRequest(BaseModel):
    stops:list[str]=Field(default_factory=list); mode:str='shortest'
class PriceSim(BaseModel):
    market_price:float; qty:float; refund_rate:float=.68; logistics:float=0; risk:float=0; fee_rate:float=.1
class Inquiry(BaseModel):
    name:str|None=None; phone:str|None=None; body:str
@app.middleware('http')
async def security_headers(request:Request,call_next):
    res=await call_next(request)
    res.headers['X-Content-Type-Options']='nosniff'; res.headers['X-Frame-Options']='DENY'; res.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    res.headers['Permissions-Policy']='camera=(self), geolocation=(self), microphone=()'
    return res
@app.post('/api/auth/login')
def login(data:Login):
    accounts={
        'brans911':('brans911!',{'id':'brans911','name':'관리자','displayName':'관리자님','role':'admin','plan':'Admin','status':'approved','token':'demo-admin'}),
        'personal':('personal123!',{'id':'personal','name':'김예찬','displayName':'김예찬님','role':'personal','plan':'Free','status':'approved','token':'demo-personal'}),
        'partner':('partner123!',{'id':'partner','name':'광주그린자원','displayName':'광주그린자원님','role':'partner','plan':'Gold','status':'approved','token':'demo-partner'}),
        'agency':('agency123!',{'id':'agency','name':'광주광역시청','displayName':'광주광역시청님','role':'agency','plan':'Pro','status':'approved','token':'demo-agency'}),
        'samsung':('samsung123!',{'id':'samsung','name':'삼성전자','displayName':'삼성전자님','role':'enterprise','plan':'ESG Plus','status':'approved','token':'demo-enterprise'}),
        'enterprise':('enterprise123!',{'id':'enterprise','name':'해빛산업','displayName':'해빛산업님','role':'enterprise','plan':'ESG Plus','status':'approved','token':'demo-enterprise'}),
    }
    row=accounts.get(data.id)
    if not row or row[0]!=data.password:
        raise HTTPException(401,'아이디 또는 비밀번호가 올바르지 않습니다.')
    token=row[1]['token']; TOKENS[token]=row[1]
    return row[1]
@app.post('/api/auth/signup')
def signup(data:Signup): return {'status':'received','message':'가입 신청이 접수되었습니다. 관리자 심사 후 승인됩니다.','role':data.role}
@app.post('/api/pickup/eligibility')
def pickup_eligibility(data:PickupEligibility):
    score=data.weight*2+data.value/1000+data.count*8+(40 if data.bulky else 0)
    eligible=data.weight>=20 or data.value>=10000 or data.count>=5 or data.bulky
    return {'eligible':eligible,'score':score,'decision':'즉시 수거 매칭 가능' if eligible else '묶음수거 대기 또는 캠페인 참여 권장','reason':'수거 기준을 충족했습니다.' if eligible else '기준 미달입니다. 같은 품목을 모으거나 캠페인 참여를 추천합니다.'}
@app.post('/api/intake/auto-fill')
def auto_fill(data:Intake):
    fields={'기관/기업명':data.organization or '', '작성목적':data.purpose or '', '대상품목':data.items or '', '보관장소/소재지':data.location or '', '일정메모':data.dates or '', '가격메모':data.amount or '', '고지':'공식 공고·입찰은 온비드와 기관 최종 절차를 우선합니다.'}
    docs=['공고정보 입력표','물건정보 입력표','예정가격 산정근거표']
    if data.purpose and '대부' in data.purpose: docs+=['국유재산 대부 검토보고서','대부조건 안내문']
    if data.purpose and 'ESG' in data.purpose: docs+=['자원순환 성과보고서','ESG/탄소중립 요약보고서']
    return {'title':'AI 자동작성 후보','summary':'최소 입력값을 바탕으로 담당자 검토용 서류 초안을 생성했습니다. OPENAI_API_KEY 연결 시 실제 GPT API로 확장합니다.','fields':fields,'documents':docs,'next':['누락정보 보완','담당자 검토','요금제 권한 확인','기관 제출용 PDF 생성']}
@app.post('/api/route/optimize')
def route_optimize(req:RouteRequest):
    stops=req.stops or ['상무지구 고객 A','광주광역시청','치평동 사무실','쌍촌동 업체']
    if req.mode=='profit': ordered=sorted(stops,key=len,reverse=True); name='수익성 우선 노선'
    elif req.mode=='time': ordered=stops; name='방문시간 우선 노선'
    else: ordered=sorted(stops); name='최단거리 우선 노선'
    return {'mode':req.mode,'stops':ordered,'distance_km':round(8+len(stops)*2.7,1),'profit_score':80+len(stops),'eta':f'{1+len(stops)//3}시간 {10+len(stops)*8}분','recommendation':name}
@app.post('/api/admin/price/simulate')
def price_sim(data:PriceSim):
    total=data.market_price*data.qty; recommend=max(0,total*data.refund_rate-data.logistics-data.risk); fee=recommend*data.fee_rate; profit=total-recommend-data.logistics-data.risk+fee
    return {'total':total,'recommend':recommend,'fee':fee,'profit':profit,'advice':'단가 낮춤·묶음수거·처리비 안내 권장' if profit<10000 else '매입 가능'}
@app.post('/api/inquiries')
def inquiry(data:Inquiry):
    item=data.model_dump(); item['id']=int(time.time()*1000); item['status']='대기'; item['answer']=''; INQUIRIES.insert(0,item); return item
@app.get('/api/inquiries')
def inquiries(): return INQUIRIES
@app.get('/api/admin/api-status')
def api_status():
    keys=['OPENAI_API_KEY','OCR_API_KEY','KAKAO_MAP_API_KEY','NAVER_MAP_API_KEY','PORTONE_API_KEY','TOSS_CLIENT_KEY','SOLAPI_API_KEY','BIZNO_API_KEY','S3_BUCKET','AWS_ACCESS_KEY_ID']
    return {k: bool(os.getenv(k)) for k in keys}
@app.get('/api/protected/forms/{form_id}')
def protected_form(form_id:str, token:str='demo-admin'):
    user=TOKENS.get(token); rule=FORM_ACCESS.get(form_id)
    if not user or not rule: raise HTTPException(404,'not found')
    filename,roles,plans=rule
    if user['status']!='approved' or (user['role'] not in roles and user['role']!='admin') or (user['plan'] not in plans and user['role']!='admin'):
        raise HTTPException(403,'승인상태, 역할 또는 요금제가 맞지 않습니다.')
    path=PROTECTED/filename
    if not path.exists(): raise HTTPException(404,'file missing')
    return FileResponse(path,filename=filename)
@app.post('/api/files/validate')
def validate_file(file:UploadFile=File(...)):
    allowed={'.pdf','.doc','.docx','.hwp','.hwpx','.xls','.xlsx','.jpg','.jpeg','.png','.webp'}
    ext=Path(file.filename or '').suffix.lower()
    if ext not in allowed: raise HTTPException(400,'허용되지 않는 확장자입니다.')
    safe=re.sub(r'[^a-zA-Z0-9_.-]','_',file.filename or 'upload.bin')
    return {'ok':True,'safe_name':safe,'ext':ext,'note':'실제 운영에서는 S3/보호 저장소에 저장합니다.'}
app.mount('/', StaticFiles(directory=STATIC, html=True), name='static')
