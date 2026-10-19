# List-KR

> [!IMPORTANT]
> About the future direction of List-KR filters: https://github.com/List-KR/List-KR/issues/1109

Please post questions or inquiries about List-KR filter lists on this repository's issue tracker. If you need private support via email, check each contributor’s GitHub profile for their contact information.

For blocking ads on Namuwiki, see [namuwiki-powerlink-blocker](https://github.com/List-KR/namuwiki-powerlink-blocker). For blocking Ad-Shield, see [adshield-defense](https://github.com/List-KR/adshield-defense).

**List-KR is not affiliated with AdGuard Software Limited. If you have issues with AdGuard filter lists, please use the [AdguardFilters](https://github.com/AdguardTeam/AdguardFilters/issues) issue tracker or the [AdGuard Report Issue Form](https://reports.adguard.com/en/new_issue.html) instead.**

---

[![jsDelivr Stats](https://data.jsdelivr.com/v1/package/npm/@list-kr/filterslists/badge)](https://www.jsdelivr.com/package/npm/@list-kr/filterslists)

List-KR is a Korean ad blocking filter list maintained by the Ad Blocking community.

## Usage

You can use the following URLs to add List-KR to your ad blocker.

> [!IMPORTANT]
> List-KR filter lists support **only** AdGuard and uBlock Origin.

**List-KR filters list for AdGuard**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-AdGuard.txt
```
**List-KR filters list for uBlock Origin**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-uBlockOrigin.txt
```

To apply all List-KR filters properly in uBO, you need to add List-KR to the trusted lists separately. Trusted filter lists can run code on web pages, so only set this up if you trust List-KR, following the steps below.

1. In the **Settings** tab of the uBO dashboard, enable **I am an advanced user**, then click the gear icon that appears next to it to open **Advanced settings**.
2. Append a space and the URL above to the end of the existing value of [`trustedListPrefixes`](https://github.com/gorhill/uBlock/wiki/Advanced-settings#trustedListPrefixes), then click **Apply changes**.
3. Go back to the **Filter lists** tab, expand **Import…**, paste the URL above, and click **Apply changes**.

**List-KR DNS**:
```
https://cdn.jsdelivr.net/npm/@list-kr/filterslists@latest/dist/filterslist-DNS.txt
```

### Naver Cafe

Ads installed in the banner area in Naver Cafe are blocked only if the ranking is fruit 1 or higher.

## Contributing

Read [CONTRIBUTING.md](https://github.com/List-KR/List-KR/blob/master/CONTRIBUTING.md).

## License

List-KR filters list is licensed under GNU GPLv3.
