# List-KR

관련된 질문은 [List-KR Discussions](https://github.com/orgs/List-KR/discussions)에 남겨주세요.

---

[![jsDelivr Stats](https://data.jsdelivr.com/v1/package/gh/List-KR/List-KR/badge)](https://www.jsdelivr.com/package/gh/List-KR/List-KR)

List-KR은 애드블록 커뮤니티와 AdGuard에서 관리하는 한국어 광고 차단 필터입니다.

지원하는 광고 차단기는 AdGuard와 uBlock Origin입니다.

이메일을 통한 비공개 지원이 필요하시면 각 기여자의 GitHub 프로필에서 연락처를 확인하실 수 있습니다.

AdGuard에 사전 탑재된 List-KR 필터 리스트는 광고와 AdGuard에서 수용하기로 결정한 법적 요청을 제외한 안티-애드블록을 처리합니다.
그러나, cdn.jsdelivr.net로 배포되는 필터 리스트들은 광고, 각 기여자가 책임을 지는 안티-애드블록, 추적기, 방해 요소 등을 처리합니다.
`filter-<PLATFORM>-unified.txt` 버전은 cdn.jsdelivr.net로 배포되는 필터 리스트 버전에 YouTube 같은 한국에서도 높은 트래픽을 가진 국제 웹 사이트에 대한 대응도 포함됩니다.

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

**AdGuard Unified**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@latest/filter-AdGuard-unified.txt
```
**uBlock Origin Unified**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@latest/filter-uBlockOrigin-unified.txt
```

**List-KR DNS**:
```
https://cdn.jsdelivr.net/gh/adguardteam/HostlistsRegistry@main/assets/filter_25.txt
```

### 유저스크립트 지원

광고 차단기에서 제공하는 기능만으로는 일부 복잡한 광고를 효율적으로 차단할 수 없습니다.

아래 사이트인 경우에는 [tinyShield 설치 방법](https://github.com/FilteringDev/tinyShield/blob/main/README.ko.md)을 참고하셔서 tinyShield 유저스크립트를 설치하셔야 합니다:
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
