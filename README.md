# List-KR
This is a web filter for websites in Korean language, to be used with [AdGuard](https://adguard.com) ad blocker and [uBlock Origin](https://github.com/gorhill/uBlock).

List-KR aims to filter ads [^1] and anti-adblock.

List-KR is focused on Korean websites and app, and it is recommended to use List-KR together with AdGuard Base filter.
If you want to block any advertisement managed by a cafe manager on Naver Cafe, rank of the cafe is fruit 1 or higher.

List-KR is optimized for AdGuard Windows, Mac, Android, Browser Extension and uBO.
Therefore, List-KR cannot be added on AdBlock Plus and [Unicorn Pro adblocker](https://getunicorn.app/en) because they do not support advanced syntax (e.g. `$$`, `#%#//scriptlet()`, [`$removeparam`](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#removeparam) and `##+js`).
Furthermore, Unicorn Pro Adblocker does not support its filter editor that is necessary to debug.
Also, Unicornsoft, owner of Unicorn Pro Adblocker, does not share their own filters for the adblock community, and they are proprietary. [Learn more](https://velog.io/@piquark6046/truth-of-unicorn-pro)

Due to technical problem, a visitor of some website need to do some instruction.
Please keep reading this document.

If you want to block tracker or anti-rightclick scripts, please enable AdGuard Tracking Protection filter, AdGuard URL Tracking filter or AdGuard Annoyances filter.

[^1]: Definition of advertisement: https://github.com/List-KR/List-KR/issues/512

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
- **[microShield](https://github.com/List-KR/microShield)** blocks complicated advertisement to block on website protected by ad-shield.
[한국어로 설치하는 방법을 알아보기](https://github.com/List-KR/microShield/blob/main/README.ko.md)
- **[NamuLink](https://github.com/List-KR/NamuLink)** blocks license-abused PowerLink advertisement on NamuWiki.
[한국어로 설치하는 방법을 알아보기](https://github.com/List-KR/NamuLink/blob/main/README.ko.md)

## Support
- [Create a GitHub Issue](https://github.com/List-KR/List-KR/issues/new/choose)
- [Send an Email](https://github.com/List-KR/List-KR/issues/223)

## How to contribute
Please read CONTRIBUTING.md.

## License
List-KR is licensed under GNU GPLv3.