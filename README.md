# List-KR

[List-KR 커뮤니티 페이지에 방문](https://community.list-kr.com)하여 AdGuard, uBlock Origin, 그리고 List-KR에 대해 더 알아볼 수 있습니다.

관련된 질문은 [List-KR Discussions](https://github.com/orgs/List-KR/discussions)에 남겨주세요.

---

[![jsDelivr Stats](https://data.jsdelivr.com/v1/package/gh/List-KR/List-KR/badge)](https://www.jsdelivr.com/package/gh/List-KR/List-KR)

List-KR은 애드블록 커뮤니티와 AdGuard에서 관리하는 한국어 광고 차단 필터입니다.

지원하는 광고 차단기는 AdGuard와 uBlock Origin입니다.
AdGuard 플렛폼에서는 별도의 안내가 없는 경우 AdGuard 베이스 필터와 함께 사용하셔야 최상의 결과를 얻으실 수 있습니다.

또 AdGuard에서 제공하는 추적 보호 필터, URL 추적 필터 그리고 방해 요소 필터 또한 함께 사용하면 웹 사이트에 설치된 추적기나 우클릭 방지 스크립트도 효율적으로 차단할 수 있습니다.

이메일을 통한 비공개 지원이 필요하시면 [community.list-kr.com의 연락처 문서](https://community.list-kr.com/docs/)에서 연락처를 확인하실 수 있습니다.

## 사용법

사용하시는 광고 차단기에 아래 URL로 List-KR을 추가할 수 있습니다.

> [!NOTE]
> iOS용 AdGuard에서는 특정 언어 필터에서 List-KR을 찾아 활성화해야 정상적인 사용이 가능합니다.

> [!IMPORTANT]
> List-KR 필터는 AdGuard와 uBlock Origin를 제외한 애드블록에서 지원되지 않으며, 사용자에 의해 추가된다고 한들 예상된 작동은 커녕 오작동을 불러올 수 있습니다.

**AdGuard**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@latest/filter-AdGuard.txt
```
**uBlock Origin**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@latest/filter-uBlockOrigin.txt
```

**List-KR DNS**:
```
https://cdn.jsdelivr.net/gh/adguardteam/HostlistsRegistry@main/assets/filter_25.txt
```

### 유저스크립트 지원

광고 차단기에서 제공하는 기능만으로는 일부 복잡한 광고를 효율적으로 차단할 수 없습니다.

아래 사이트인 경우에는 [microShield 설치 방법](https://community.list-kr.com/docs/AdGuard/Userscripts/microShield)을 참고하셔서 microShield 유저스크립트를 설치하셔야 합니다:
 - m.inven.co.kr
 - loawa.com
 - mlbpark.donga.com
 - a-ha.io
 - dogdrip.net
 - ygosu.com
 - etoday.co.kr
 - jjang0u.com

 그 외 여러 사이트들

### 네이버 카페

네이버 카페 내의 배너 구좌에 설치된 광고는 열매 1 이상 랭킹인 경우에만 차단됩니다.

## 기여하기

[CONTRIBUTING.md](https://github.com/List-KR/List-KR/blob/master/CONTRIBUTING.md)를 읽어주세요.

## 라이선스

List-KR 필터는 GNU GPLv3하에 라이선스됩니다.
