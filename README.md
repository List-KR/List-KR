# List-KR
<details>
<summary>Other Language - 다른 언어</summary>

한국어: https://github.com/List-KR/List-KR/blob/master/README.ko.md

</details>

힌국어로 AdGuard나 uBlock Origin 또는 List-KR에 대해 아시고 싶으신 점이 있으신가요? [List-KR Wiki에 방문](https://github.com/List-KR/List-KR/wiki)해보세요.

---

List-KR filter is a filter for websites in Korean language, to be used with [AdGuard](https://adguard.com) ad blocker and [uBlock Origin](https://github.com/gorhill/uBlock).

List-KR filter aims to filter ads [^1] and anti-adblock.

List-KR filter is focused on Korean websites and app, and it is recommended to use List-KR filter together with AdGuard Base filter.
If you want to block any advertisement managed by a cafe manager on Naver Cafe, rank of the cafe must be fruit 1 or higher.

List-KR filter is optimized for AdGuard products and uBO.
Therefore, List-KR filter cannot be added on AdBlock Plus and [Unicorn Pro adblocker](https://getunicorn.app/en) because they do not support advanced syntax (e.g. `$$`, `#%#//scriptlet()`, [`$removeparam`](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#removeparam) and `##+js`).
Furthermore, Unicorn Pro Adblocker does not support its filter editor that is necessary to debug.
Also, Unicornsoft, owner of Unicorn Pro Adblocker, does not share their own filters for the adblock community, and they are proprietary. [Learn more](https://velog.io/@piquark6046/truth-of-unicorn-pro)
List-KR filter is being maintained by the adblock community and AdGuard.

Due to technical problem, a visitor of some website need to do some instruction.
Please keep reading this document.

If you want to block tracker or anti-rightclick scripts, please enable AdGuard Tracking Protection filter, AdGuard URL Tracking filter or AdGuard Annoyances filter.

If you want to get supported or know email address of each maintainer, please read [this issue](https://github.com/List-KR/List-KR/issues/223).

[^1]: Definition of advertisement in List-KR filter: https://github.com/List-KR/List-KR/issues/512

## How to use
In the program you would like to use, use the following url to subscribe to or import.

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

## microShield and NamuLink
- **[microShield](https://github.com/List-KR/microShield)** userscript blocks complicated advertisement to block on website protected by ad-shield.
- **[NamuLink](https://github.com/List-KR/NamuLink)** userscript blocks license-abused PowerLink advertisement on NamuWiki.

## How to contribute
Please read CONTRIBUTING.md.

## License
List-KR filter is licensed under GNU GPLv3.