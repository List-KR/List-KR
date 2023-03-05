# List-KR

힌국어로 AdGuard나 uBlock Origin 또는 List-KR에 대해 아시고 싶으신 점이 있으신가요? [List-KR Wiki에 방문](https://github.com/List-KR/List-KR/wiki)해보세요.

AdGuard, uBlock Origin에 대한 질문이나 문제가 있으신가요? [List-KR Discussions에 방문](https://github.com/List-KR/List-KR/discussions)해보세요.

---

List-KR 필터는 [AdGuard](https://adguard.com) 광고 차단기와 [uBlock Origin](https://github.com/gorhill/uBlock)과 함께 사용되는 한국어 웹 사이트용 필터입니다.

List-KR 필터는 광고 [^1]와 안티-애드블록을 필터하는 것을 목표로 합니다.

List-KR 필터는 한국어 웹 사이트와 앱에 집중하며 AdGuard 베이스 필터와 함께 List-KR 필터를 사용하는 것을 추천합니다.
만약 네이버 카페에 있는 한 카페 매니저에 의해 관리되는 광고를 차단하시길 원하시면, 그 카페의 랭킹은 열매 1 이상이여야 합니다.

List-KR 필터는 AdGuard 제품들과 uBO에 최적화되어 있습니다.
따라서, List-KR 필터는 AdBlock Plus와 [유니콘 Pro 광고차단기](https://getunicorn.app/ko)가 고급 문법(예: `$$`, `#%#//scriptlet()`, [`$removeparam`](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#removeparam) and `##+js`)을 지원하지 않기 때문에 그 광고 차단기들에 추가될 수 없습니다.
게다가, 유니콘 Pro 광고차단기는 디버그에 필요한 필터 편집기를 제공하기 않습니다.
또한, 유니콘 Pro 광고차단기의 소유자인 유니콘소프트는 애드블록 커뮤니티를 위해 그들의 자체 필터들을 공유하지 않으며 사유 소프트웨어입니다.
List-KR 필터는 애드블록 커뮤니티와 AdGuard에 의해 유지보수되어 지고 있습니다.

기술적 문제로 인해 일부 웹사이트들의 방문자는 일부 설명을 따라야 합니다.
이 문서를 계속해서 읽어주세요.

만약 추격기나 우클릭 방지 스크립트를 차단하시고 싶으시면, AdGuard 추적 보호 필터, AdGuard URL 추적 필터나 AdGuard 방해 요소 필터를 활성화하세요.

만약에 지원을 받으시거나 각 매인테이너의 이메일 주소를 아시고 싶으시면, [이 위키 문서](https://github.com/List-KR/List-KR/wiki/contacts)를 읽어주세요.


[^1]: List-KR 필터에서 광고의 정의: https://github.com/List-KR/List-KR/issues/512

## 사용하는 방법

프로그램에서 사용하시고 싶으시면, 구독하거나 불러오기 위해 다음 URL를 사용해주세요.

**List-KR** (AdGuard):
```
https://github.com/List-KR/List-KR/raw/master/filter.txt
```
**List-KR uBO** (uBlock Origin):
```
https://github.com/List-KR/List-KR/raw/master/filter-uBO.txt
```
**List-KR DNS**:
```
https://adguardteam.github.io/HostlistsRegistry/assets/filter_25.txt
```

## microShield와 NamuLink
- **[microShield](https://github.com/List-KR/microShield)** 유저스크립트는 애드쉴드에 보호된 웹 사이트에 있는 차단하기 복잡한 광고를 차단합니다.
[한국어로 설치하는 방법을 알아보기](https://github.com/List-KR/microShield/blob/main/README.ko.md)
- **[NamuLink](https://github.com/List-KR/NamuLink)** 유저스크립트는 나무위키에 있는 라이선스를 위반한 파워링크 광고를 차단합니다.
[한국어로 설치하는 방법을 알아보기](https://github.com/List-KR/NamuLink/blob/main/README.ko.md)

## 기여하는 방법
CONTRIBUTING.md를 읽어주세요.

## 라이선스
List-KR 필터는 GNU GPLv3하에 라이선스됩니다.
