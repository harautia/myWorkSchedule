---
title: FAQ
description: Common questions about myWorkSchedule.
---

## Is it free?

Yes. The software is free and open source under the
[GNU Affero General Public License v3](https://github.com/harautia/myWorkSchedule/blob/master/LICENSE).
You can run it yourself at no cost. A paid hosted service is planned for bars that would
rather not maintain a server; it will have the same features.

## Can I use it for my business, or offer it to others?

Yes, including commercially. If you **change the code** and let others use your changed
version over the network, the licence requires you to make your changed source code
available to them (set `APP_SOURCE_URL` to point to it). If you offer it to others, use
your own name and logo; see the
[trademark policy](https://github.com/harautia/myWorkSchedule/blob/master/TRADEMARK.md).

## Is there a mobile app?

The web app works on phones and can be installed on the home screen (it's a progressive
web app). Employees get a "My shifts" list, and the last loaded schedule is available
offline.

## Does my installation send any data to the project?

No. A self-hosted copy never contacts the project: no usage statistics and no update
checks. Your data stays on your server.

## Which languages are supported?

English and Finnish. Each bar chooses its language in its settings; everyone in the bar
sees the app in that language. New languages can be contributed as translation files,
without changing code; see [contributing](../contributing/).

## How big a server do I need?

A small server with 1 GB of memory is enough for many bars. The app and PostgreSQL run
comfortably together on it.

## Where do I get help?

Open an issue on [GitHub](https://github.com/harautia/myWorkSchedule/issues). Report
security problems privately; see
[SECURITY.md](https://github.com/harautia/myWorkSchedule/blob/master/SECURITY.md).
