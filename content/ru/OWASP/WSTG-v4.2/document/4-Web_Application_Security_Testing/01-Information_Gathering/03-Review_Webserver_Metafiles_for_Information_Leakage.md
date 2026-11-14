# Анализ метафайлов веб-сервера на предмет утечки информации

|ID          |
|------------|
|WSTG-INFO-03|

## Краткое описание

В этом разделе описано, как проверять различные файлы метаданных на утечку сведений о путях или функциональных возможностях веб-приложения. Кроме того, можно составить список каталогов, которые поисковые роботы должны обходить стороной, как исходные данные для [построения карты путей выполнения в приложении](07-Map_Execution_Paths_Through_Application.md). Можно также собирать другие сведения для определения поверхности атаки, получения технических подробностей или использования при проверках с применением социальной инженерии.

## Цели тестирования

- Выявить скрытые или замаскированные пути и функциональные возможности посредством анализа файлов метаданных.
- Извлечь и систематизировать другие сведения, позволяющие лучше понять исследуемые системы.

## Методика тестирования

> Все приведённые ниже действия с `wget` можно выполнить и с помощью `curl`. Многие инструменты динамического тестирования безопасности приложений (DAST), такие как ZAP и Burp Suite, включают проверку или разбор этих ресурсов в функции обхода сайтов. Их также можно выявить с помощью различных [запросов Google для доркинга](https://en.wikipedia.org/wiki/Google_hacking) или расширенных средств поиска, например `inurl:`.

### Поисковые роботы

Поисковые роботы, также называемые пауками или краулерами, получают веб-страницу, а затем рекурсивно переходят по гиперссылкам, загружая дополнительный веб-контент. Принятые правила их поведения определяются [протоколом исключений для роботов](https://www.robotstxt.org) в файле [robots.txt](https://www.robotstxt.org/), находящемся в корневом веб-каталоге.

В качестве примера ниже приведено начало файла `robots.txt` [Google](https://www.google.com/robots.txt), полученного 5 мая 2020 года:

```text
User-agent: *
Disallow: /search
Allow: /search/about
Allow: /search/static
Allow: /search/howsearchworks
Disallow: /sdch
...
```

Директива [User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent) указывает конкретного поискового робота. Например, `User-Agent: Googlebot` обозначает робота Google, а `User-Agent: bingbot` — робота Microsoft. В приведённом выше примере `User-Agent: *` относится ко всем [поисковым роботам](https://support.google.com/webmasters/answer/6062608?visit_id=637173940975499736-3548411022&rd=1).

Директива `Disallow` определяет ресурсы, доступ к которым запрещён поисковым роботам. В приведённом выше примере запрещены следующие ресурсы:

```text
...
Disallow: /search
...
Disallow: /sdch
...
```

Поисковые роботы могут [намеренно игнорировать](https://blog.isc2.org/isc2_blog/2008/07/the-attack-of-t.html) директивы `Disallow` в файле `robots.txt`: например, роботы [социальных сетей](https://www.htbridge.com/news/social_networks_can_robots_violate_user_privacy.html) могут делать это для проверки действительности ссылок, которыми делятся пользователи. Поэтому `robots.txt` не следует считать механизмом принудительного ограничения доступа третьих сторон к веб-контенту, его хранения или повторной публикации.

Файл `robots.txt` получают из корневого веб-каталога веб-сервера. Например, чтобы получить `robots.txt` с `www.google.com` с помощью `wget` или `curl`:

```bash
$ curl -O -Ss http://www.google.com/robots.txt && head -n5 robots.txt
User-agent: *
Disallow: /search
Allow: /search/about
Allow: /search/static
Allow: /search/howsearchworks
...
```

#### Анализ robots.txt с помощью Google Webmaster Tools

Владельцы сайтов могут использовать функцию Google «Analyze robots.txt» для анализа сайта в составе [Google Webmaster Tools](https://www.google.com/webmasters/tools). Этот инструмент может помочь при тестировании; порядок действий следующий:

1. Войдите в Google Webmaster Tools с помощью учётной записи Google.
2. На панели управления введите URL анализируемого сайта.
3. Выберите один из доступных методов и следуйте указаниям на экране.

### Теги META

Теги `<META>` находятся в разделе `HEAD` каждого HTML-документа и должны быть согласованы на всём сайте на случай, если поисковый робот начинает обход по ссылке на документ вне корня сайта, то есть по [глубокой ссылке](https://en.wikipedia.org/wiki/Deep_linking). Директиву для роботов можно также задать с помощью специального [тега META](https://www.robotstxt.org/meta.html).

#### Тег META для роботов

Если запись `<META NAME="ROBOTS" ... >` отсутствует, протокол исключений для роботов по умолчанию предполагает `INDEX,FOLLOW` соответственно. Два других допустимых значения, определённых протоколом исключений для роботов, имеют префикс `NO...`: это `NOINDEX` и `NOFOLLOW`.

На основании директив Disallow из файла `robots.txt` в корне сайта выполняют поиск `<META NAME="ROBOTS"` с помощью регулярного выражения на каждой веб-странице и сравнивают результат с файлом `robots.txt` в корне сайта.

#### Прочие информационные теги META

Организации часто встраивают в веб-контент информационные теги META для поддержки различных технологий: программ чтения с экрана, предварительного просмотра в социальных сетях, индексирования поисковыми системами и т. д. Такие метаданные могут помочь тестировщикам определить используемые технологии, а также дополнительные пути и функциональные возможности для исследования и проверки. Следующие метаданные получены с `www.whitehouse.gov` через просмотр исходного кода страницы 5 мая 2020 года:

```html
...
<meta property="og:locale" content="en_US" />
<meta property="og:type" content="website" />
<meta property="og:title" content="The White House" />
<meta property="og:description" content="We, the citizens of America, are now joined in a great national effort to rebuild our country and to restore its promise for all. – President Donald Trump." />
<meta property="og:url" content="https://www.whitehouse.gov/" />
<meta property="og:site_name" content="The White House" />
<meta property="fb:app_id" content="1790466490985150" />
<meta property="og:image" content="https://www.whitehouse.gov/wp-content/uploads/2017/12/wh.gov-share-img_03-1024x538.png" />
<meta property="og:image:secure_url" content="https://www.whitehouse.gov/wp-content/uploads/2017/12/wh.gov-share-img_03-1024x538.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:description" content="We, the citizens of America, are now joined in a great national effort to rebuild our country and to restore its promise for all. – President Donald Trump." />
<meta name="twitter:title" content="The White House" />
<meta name="twitter:site" content="@whitehouse" />
<meta name="twitter:image" content="https://www.whitehouse.gov/wp-content/uploads/2017/12/wh.gov-share-img_03-1024x538.png" />
<meta name="twitter:creator" content="@whitehouse" />
...
<meta name="apple-mobile-web-app-title" content="The White House">
<meta name="application-name" content="The White House">
<meta name="msapplication-TileColor" content="#0c2644">
<meta name="theme-color" content="#f5f5f5">
...
```

### Карты сайтов

Карта сайта — это файл, в котором разработчик или организация может указать сведения о страницах, видеозаписях и других файлах сайта или приложения и связях между ними. Поисковые системы могут использовать этот файл для более осмысленного обхода сайта. Тестировщики могут получать дополнительные сведения о сайте или приложении из файлов `sitemap.xml`, чтобы исследовать его полнее.

Ниже приведён фрагмент основной карты сайта Google, полученной 5 мая 2020 года.

```bash
$ wget --no-verbose https://www.google.com/sitemap.xml && head -n8 sitemap.xml
2020-05-05 12:23:30 URL:https://www.google.com/sitemap.xml [2049] -> "sitemap.xml" [1]

<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.google.com/schemas/sitemap/0.84">
  <sitemap>
    <loc>https://www.google.com/gmail/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.google.com/forms/sitemaps.xml</loc>
  </sitemap>
...
```

Продолжая исследование, тестировщик может захотеть получить карту сайта Gmail `https://www.google.com/gmail/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.google.com/intl/am/gmail/about/</loc>
    <xhtml:link href="https://www.google.com/gmail/about/" hreflang="x-default" rel="alternate"/>
    <xhtml:link href="https://www.google.com/intl/el/gmail/about/" hreflang="el" rel="alternate"/>
    <xhtml:link href="https://www.google.com/intl/it/gmail/about/" hreflang="it" rel="alternate"/>
    <xhtml:link href="https://www.google.com/intl/ar/gmail/about/" hreflang="ar" rel="alternate"/>
...
```

### Файл security.txt

`security.txt` — это [предлагаемый стандарт](https://securitytxt.org/), позволяющий сайтам определять политики безопасности и контактные данные. При тестировании это может быть интересно по ряду причин, включая, помимо прочего:

- Выявление дополнительных путей или ресурсов для включения в поиск и анализ.
- Сбор разведывательной информации из открытых источников.
- Поиск сведений о программах вознаграждения за обнаружение уязвимостей и т. п.
- Социальную инженерию.

Файл может находиться как в корне веб-сервера, так и в каталоге `.well-known/`. Например:

- `https://example.com/security.txt`
- `https://example.com/.well-known/security.txt`

Ниже приведён реальный пример, полученный с LinkedIn 5 мая 2020 года:

```bash
$ wget --no-verbose https://www.linkedin.com/.well-known/security.txt && cat security.txt
2020-05-07 12:56:51 URL:https://www.linkedin.com/.well-known/security.txt [333/333] -> "security.txt" [1]
# Conforms to IETF `draft-foudil-securitytxt-07`
Contact: mailto:security@linkedin.com
Contact: https://www.linkedin.com/help/linkedin/answer/62924
Encryption: https://www.linkedin.com/help/linkedin/answer/79676
Canonical: https://www.linkedin.com/.well-known/security.txt
Policy: https://www.linkedin.com/help/linkedin/answer/62924
```

### Файл humans.txt

`humans.txt` — инициатива, позволяющая узнать о людях, стоящих за сайтом. Это текстовый файл со сведениями о разных людях, участвовавших в создании сайта. Подробнее см. [humanstxt](http://humanstxt.org/). Этот файл часто, хотя и не всегда, содержит сведения о сайтах или путях с информацией о карьере и вакансиях.

Следующий пример получен с Google 5 мая 2020 года:

```bash
$ wget --no-verbose  https://www.google.com/humans.txt && cat humans.txt
2020-05-07 12:57:52 URL:https://www.google.com/humans.txt [286/286] -> "humans.txt" [1]
Google is built by a large team of engineers, designers, researchers, robots, and others in many different sites across the globe. It is updated continuously, and built with more tools and technologies than we can shake a stick at. If you'd like to help us out, see careers.google.com.
```

### Другие источники информации в .well-known

Существуют и другие RFC и проекты интернет-стандартов, предлагающие стандартные способы использования файлов в каталоге `.well-known/`. Их перечни можно найти [здесь](https://en.wikipedia.org/wiki/List_of_/.well-known/_services_offered_by_webservers) или [здесь](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml).

Тестировщику достаточно просто изучить эти RFC и проекты и составить список для средства обхода или фаззера, чтобы проверить наличие или содержимое таких файлов.

## Инструменты

- Браузер: просмотр исходного кода или инструменты разработчика
- curl
- wget
- Burp Suite
- ZAP
