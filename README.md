# List-KR

> [!IMPORTANT]
> 향후 List-KR 필터의 운영 방향에 대한 안내: https://github.com/List-KR/List-KR/issues/1109

List-KR 필터 리스트에 관련된 질문이나 문의는 이 레포의 이슈 트래커에 올려주세요. 이메일을 통한 비공개 지원이 필요하시면 각 기여자의 GitHub 프로필에서 연락처를 확인하실 수 있습니다.

나무위키 광고차단은 [namuwiki-powerlink-blocker](https://github.com/List-KR/namuwiki-powerlink-blocker), Ad-Shield 차단은 [adshield-defense](https://github.com/List-KR/adshield-defense) 레포지토리를 참고해주세요.

**List-KR은 AdGuard Software Limited와 연관이 없습니다. AdGuard 필터 리스트 이슈라면 [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters/issues) 이슈 트래커 또는 [Adguard 익명 제보 시스템](https://reports.adguard.com/ko/new_issue.html)을 이용해주세요.**

---

[![jsDelivr Stats](https://data.jsdelivr.com/v1/package/npm/@list-kr/filterslists/badge)](https://www.jsdelivr.com/package/npm/@list-kr/filterslists)

List-KR은 애드블록 커뮤니티에서 관리하는 한국어 광고 차단 필터 리스트입니다.

이메일을 통한 비공개 지원이 필요하시면 각 기여자의 GitHub 프로필에서 연락처를 확인하실 수 있습니다.

## 사용법

사용하시는 광고 차단기에 아래 URL로 List-KR을 추가할 수 있습니다.

> [!IMPORTANT]
> List-KR은 **오직** AdGuard와 uBlock Origin만 지원합니다.

**List-KR filters list for AdGuard**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt
```
**List-KR filters list for uBlock Origin**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-uBlockOrigin.txt
```

uBO에서 List-KR의 모든 필터를 제대로 적용하려면 List-KR을 신뢰 목록에 따로 등록해야 합니다. 신뢰 목록에 등록된 필터는 웹페이지에서 코드를 실행할 수 있으니, List-KR을 믿고 사용할 때만 아래 순서대로 설정해 주세요.

1. uBO 대시보드의 **설정** 탭에서 **저는 고급 사용자입니다**를 켠 뒤, 오른쪽에 나타나는 톱니바퀴를 눌러 **고급 설정**을 엽니다.
2. [`trustedListPrefixes`](https://github.com/gorhill/uBlock/wiki/Advanced-settings#trustedListPrefixes)의 기존 값 맨 뒤에 공백을 하나 넣고 위 URL을 붙인 다음 **변경사항 적용**을 누릅니다.
3. **필터 목록** 탭으로 돌아가 **가져오기…**를 펼친 뒤, 위 URL을 붙여 넣고 **변경사항 적용**을 누릅니다.

**List-KR DNS**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-DNS.txt
```

### 네이버 카페

네이버 카페 내의 배너 구좌에 설치된 광고는 열매 1 이상 랭킹인 경우에만 차단됩니다.

## 기여하기

[CONTRIBUTING.md](https://github.com/List-KR/List-KR/blob/master/CONTRIBUTING.md)를 읽어주세요.

## 라이선스

List-KR 필터 리스트는 GNU GPLv3하에 라이선스됩니다.
