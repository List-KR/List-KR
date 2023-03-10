# List-KR

[![jsDelivr Stats](https://data.jsdelivr.com/v1/package/gh/List-KR/List-KR/badge)](https://www.jsdelivr.com/package/gh/List-KR/List-KR)

List-KR filter is a filter for websites in Korean language, to be used with [AdGuard](https://adguard.com) ad blocker and [uBlock Origin](https://github.com/gorhill/uBlock).

List-KR filter aims to filter ads [^1] and anti-adblock.

List-KR filter is focused on Korean websites and app, and it is recommended to use List-KR filter together with AdGuard Base filter.
If you want to block any advertisement managed by a cafe manager on Naver Cafe, rank of the cafe must be fruit 1 or higher.

**List-KR filter is optimized for only AdGuard products and uBO**.
Therefore, List-KR filter cannot be added on AdBlock Plus and [Unicorn Pro adblocker](https://getunicorn.app/en) because they do not support advanced syntax (e.g. `$$`, `#%#//scriptlet()`, [`$removeparam`](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#removeparam) and `##+js`).
Furthermore, Unicorn Pro Adblocker does not support its filter editor that is necessary to debug.
Also, Unicornsoft, owner of Unicorn Pro Adblocker, does not share their own filters for the adblock community, and they are proprietary.
List-KR filter is being maintained by the adblock community and AdGuard.

Due to technical problem, a visitor of some website need to do some instruction.
Please keep reading this document.

If you want to block tracker or anti-rightclick scripts, please enable AdGuard Tracking Protection filter, AdGuard URL Tracking filter or AdGuard Annoyances filter.

If you want to get supported or know email address of each maintainer, please read [this wiki document](https://github.com/List-KR/List-KR/wiki/contacts).

[^1]: Definition of advertisement in List-KR filter: https://github.com/List-KR/List-KR/issues/512

## How to use
In the program you would like to use, use the following url to subscribe to or import.

**List-KR for AdGuard**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@master/filter-AdGuard.txt
```
**List-KR for uBlock Origin**:
```
https://cdn.jsdelivr.net/gh/List-KR/List-KR@master/filter-uBlockOrigin.txt
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