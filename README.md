# List-KR
This is a web filter for websites in Korean language, to be used with [AdGuard](https://adguard.com) ad blocker and [uBlock Origin](https://github.com/gorhill/uBlock).

List-KR aims to filter ads and anti-adblock.

List-KR is focused on Korean websites and app, and it is recommended to use List-KR together with AdGuard Base filter.

List-KR is optimized for AdGuard Windows, Mac, Android, Browser Extension and uBO.
Therefore, List-KR cannot be added on AdBlock Plus and [Unicorn Pro adblocker](https://getunicorn.app/en) because they do not support advanced syntax (e.g. `!#include`, `#%#//scriptlet()`, `##+js` and `$redirect`).

Due to technical problem, a visitor of some website need to do some instruction.
Please keep reading this document.

If you want to block tracker or anti-rightclick scripts, please enable AdGuard Tracking Protection filter, AdGuard URL Tracking filter or AdGuard Annoyances filter.

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
<details>
<summary>List-KR Experimental</summary>

List-KR provides you an experimental version of List-KR to resolve problematic issues like Ad-Shield and NamuWiki without an userscript.

Any problematic rules/filters can cause an incorrect blocking or false-positive.

If you want to learn more, please visit [#411](https://github.com/List-KR/List-KR/issues/411) and [#412](https://github.com/List-KR/List-KR/pull/412)

**List-KR Experimental** (AdGuard):
```
https://github.com/List-KR/List-KR/raw/master/filter-experimental.txt
```

**List-KR uBO Experimental** (uBlock Origin):
```
https://github.com/List-KR/List-KR/raw/master/filter-uBO-experimental.txt
```

</details>

## microShield and NamuLink
- **[microShield](https://github.com/List-KR/microShield)** blocks complicated advertisement to block on website protected by ad-shield.
- **[NamuLink](https://github.com/List-KR/NamuLink)** blocks license-abused PowerLink advertisement on NamuWiki.

## List-KR Extension
- **List-KR Extension** blocks low-quality user-made advertisement.
    ```
    https://github.com/List-KR/List-KR/raw/master/filter_Extension.txt
    ```

## Support
- [Create a GitHub Issue](https://github.com/List-KR/List-KR/issues/new/choose)
- [Send an Email](https://github.com/List-KR/List-KR/issues/223)

## How to contribute
Please read CONTRIBUTING.md.

## License
List-KR is licensed under GNU GPLv3.