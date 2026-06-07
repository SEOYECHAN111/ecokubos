# 자원잇다 v28 Visual Icon Polished

생성 이미지와 3D 아이콘을 실제 다중 페이지 홈페이지에 적용한 버전입니다.

## 핵심 반영
- 공개 상단 메뉴는 홈/사진수거/캠페인/요금제/공지/고객센터만 유지
- 기관·업체·기업·입찰방·수거지도·최적노선은 로그인 후 역할·플랜별 노출
- 생성한 히어로 이미지와 3D 아이콘을 홈, 역할별 페이지, 대시보드에 배치
- 이미지 WebP 최적화 및 깨짐 시 fallback 처리
- 통합 로그인 후 계정 역할에 따라 자동 대시보드 이동
- 내 설정에서 표시 이름/연락처/비밀번호 변경 UI 제공

## 실행
```bash
python -m uvicorn main:app --reload
```

접속: http://127.0.0.1:8000/

## 데모 계정
- 관리자: brans911 / brans911!
- 개인: personal / personal123!
- 업체: partner / partner123!
- 기관: agency / agency123!
- 기업: samsung / samsung123!
