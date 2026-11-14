# Определение точек входа в приложение

|ID          |
|------------|
|WSTG-INFO-06|

## Краткое описание

Выявление компонентов приложения и его поверхности атаки — необходимая подготовка к любому тщательному тестированию: она позволяет определить вероятные слабые места. Этот раздел помогает выявить и обозначить области приложения, которые следует исследовать после завершения инвентаризации и составления карты.

## Цели тестирования

- Выявить возможные точки входа и внедрения посредством анализа запросов и ответов.

## Методика тестирования

Перед началом любого тестирования тестировщику следует хорошо разобраться в приложении и в том, как с ним взаимодействуют пользователь и браузер. При исследовании приложения обращайте внимание на все HTTP-запросы, а также на каждый параметр и поле формы, передаваемые приложению. Особого внимания заслуживает то, когда для передачи параметров используются запросы GET, а когда POST. Кроме того, следует отмечать применение других методов в RESTful-сервисах.

Для просмотра параметров, передаваемых в теле запросов, например POST, может понадобиться перехватывающий прокси; см. [инструменты](#tools). В запросах POST особенно отмечайте скрытые поля формы, передаваемые приложению: они обычно содержат конфиденциальные сведения, например состояние, количество товаров и их стоимость, которые разработчик не предполагал предоставлять для просмотра или изменения.

По опыту автора, на этом этапе очень полезны перехватывающий прокси и электронная таблица. Прокси сохраняет все запросы и ответы между тестировщиком и приложением во время исследования. Кроме того, на этом этапе тестировщики обычно перехватывают каждый запрос и ответ, чтобы в точности увидеть все заголовки, параметры и прочие данные, передаваемые приложению и возвращаемые им. Иногда это весьма утомительно, особенно для крупных интерактивных сайтов, например банковского приложения. Однако с опытом становится понятно, что искать, и этот этап можно значительно сократить.

При исследовании приложения отмечайте интересные параметры URL, нестандартных заголовков или тела запросов и ответов и заносите их в электронную таблицу. Она должна содержать запрошенную страницу; для дальнейших ссылок полезно добавить номер запроса из прокси, интересные параметры, тип запроса (GET, POST и т. д.), наличие или отсутствие аутентификации, использование TLS, принадлежность к многошаговому процессу, использование WebSocket и другие существенные замечания. Составив карту всех областей приложения, можно пройти по нему и проверить каждую выявленную область, отмечая, что сработало, а что нет. Остальная часть руководства объясняет проверку каждой такой области, но описанную здесь работу необходимо выполнить до начала собственно тестирования.

Ниже перечислены некоторые моменты, заслуживающие внимания во всех запросах и ответах. В части запросов сосредоточьтесь на GET и POST, поскольку они составляют большинство запросов. Помните, что могут использоваться и другие методы, например PUT и DELETE. Такие более редкие запросы, если они разрешены, нередко выявляют уязвимости. Проверке этих HTTP-методов посвящён отдельный раздел руководства.

### Запросы

- Определите, где используются GET, а где POST.
- Выявите все параметры запросов POST: они находятся в теле запроса.
- В запросах POST особенно обращайте внимание на скрытые параметры. При отправке POST все поля формы, включая скрытые, передаются приложению в теле HTTP-сообщения. Обычно они незаметны без прокси или просмотра исходного HTML-кода. Кроме того, следующая отображаемая страница, её данные и уровень доступа могут различаться в зависимости от значений скрытых параметров.
- Выявите все параметры запросов GET, то есть URL, в особенности строку запроса, обычно следующую после знака ?.
- Выявите все параметры строки запроса. Обычно они представлены парами, например `foo=bar`. В одной строке может быть много параметров, разделённых `&`, `\~`, `:` или другими специальными символами либо кодированными последовательностями.
- При выявлении нескольких параметров в одной строке или в запросе POST учитывайте, что для выполнения атак могут понадобиться некоторые из них или все. Тестировщику необходимо выявить все параметры, даже закодированные или зашифрованные, и определить, какие из них обрабатывает приложение. В последующих разделах объясняется, как их тестировать. Пока убедитесь, что выявлен каждый параметр.
- Обращайте внимание и на дополнительные или нестандартные заголовки, встречающиеся редко, например `debug: false`.

### Ответы

- Определите, где устанавливаются новые cookie-файлы через заголовок `Set-Cookie`, а также где они изменяются или дополняются.
- Выявите перенаправления с HTTP-кодами состояния 3xx, коды 400, в частности 403 Forbidden, и внутренние ошибки сервера 500 в обычных ответах, то есть на неизменённые запросы.
- Отмечайте использование интересных заголовков. Например, `Server: BIG-IP` указывает на балансировку нагрузки сайта. Если один из серверов такого сайта настроен неправильно, для обращения к уязвимому серверу может понадобиться несколько запросов в зависимости от типа балансировки.

### Тестирование методом «чёрного ящика»

#### Проверка точек входа в приложение

Ниже приведены два примера проверки точек входа в приложение.

#### Пример 1

В этом примере показан запрос GET для покупки товара в приложении интернет-магазина.

```http
GET /shoppingApp/buyme.asp?CUSTOMERID=100&ITEM=z101a&PRICE=62.50&IP=x.x.x.x HTTP/1.1
Host: x.x.x.x
Cookie: SESSIONID=Z29vZCBqb2IgcGFkYXdhIG15IHVzZXJuYW1lIGlzIGZvbyBhbmQgcGFzc3dvcmQgaXMgYmFy
```

> Здесь тестировщику следует отметить все параметры запроса: CUSTOMERID, ITEM, PRICE, IP и Cookie, который может содержать просто закодированные параметры либо использоваться для состояния сеанса.

#### Пример 2

В этом примере показан запрос POST для входа в приложение.

```http
POST /KevinNotSoGoodApp/authenticate.asp?service=login HTTP/1.1
Host: x.x.x.x
Cookie: SESSIONID=dGhpcyBpcyBhIGJhZCBhcHAgdGhhdCBzZXRzIHByZWRpY3RhYmxlIGNvb2tpZXMgYW5kIG1pbmUgaXMgMTIzNA==;CustomCookie=00my00trusted00ip00is00x.x.x.x00

user=admin&pass=pass123&debug=true&fromtrustIP=true
```

> Как и ранее, тестировщику следует отметить все параметры, но здесь большинство из них передаётся в теле запроса, а не в URL. Кроме того, обратите внимание на используемый нестандартный HTTP-заголовок (`CustomCookie`).

### Тестирование методом «серого ящика»

Проверка точек входа методом «серого ящика» включает всё описанное выше с одним дополнением. Если существуют внешние источники, из которых приложение получает и обрабатывает данные, например SNMP traps, сообщения syslog, SMTP или SOAP с других серверов, встреча с разработчиками может помочь выявить функции, принимающие или ожидающие пользовательский ввод, и его формат. Например, разработчик может объяснить, как сформировать корректный SOAP-запрос, принимаемый приложением, и где находится веб-сервис, если он или другая функция ещё не выявлены при тестировании методом «чёрного ящика».

#### OWASP Attack Surface Detector

Инструмент Attack Surface Detector (ASD) исследует исходный код и выявляет конечные точки веб-приложения, принимаемые ими параметры и типы данных этих параметров. В том числе он находит конечные точки без ссылок, которые не обнаружит средство обхода, и необязательные параметры, вообще не используемые в клиентском коде. Он также умеет вычислять изменения поверхности атаки между двумя версиями приложения.

Attack Surface Detector доступен в виде плагинов для ZAP и Burp Suite, а также инструмента командной строки. Последний экспортирует поверхность атаки в JSON, который затем могут использовать плагины ZAP и Burp Suite. Это полезно, когда исходный код не предоставляется специалисту по тестированию на проникновение напрямую. Например, заказчик, не желающий передавать сам код, может предоставить файл JSON с результатами работы инструмента.

##### Использование

JAR-файл инструмента командной строки доступен для скачивания на [странице выпусков](https://github.com/secdec/attack-surface-detector-cli/releases).

Чтобы ASD выявил конечные точки по исходному коду целевого веб-приложения, выполните следующую команду.

`java -jar attack-surface-detector-cli-1.3.5.jar <source-code-path> [flags]`

Ниже приведён пример запуска команды для [OWASP RailsGoat](https://github.com/OWASP/railsgoat).

```text
$ java -jar attack-surface-detector-cli-1.3.5.jar railsgoat/
Beginning endpoint detection for '<...>/railsgoat' with 1 framework types
Using framework=RAILS
[0] GET: /login (0 variants): PARAMETERS={url=name=url, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/sessions_contro
ller.rb (lines '6'-'9')
[1] GET: /logout (0 variants): PARAMETERS={}; FILE=/app/controllers/sessions_controller.rb (lines '33'-'37')
[2] POST: /forgot_password (0 variants): PARAMETERS={email=name=email, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/
password_resets_controller.rb (lines '29'-'38')
[3] GET: /password_resets (0 variants): PARAMETERS={token=name=token, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/p
assword_resets_controller.rb (lines '19'-'27')
[4] POST: /password_resets (0 variants): PARAMETERS={password=name=password, paramType=QUERY_STRING, dataType=STRING, user=name=user, paramType=QUERY_STRING, dataType=STRING, confirm_password=name=confirm_password, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/password_resets_controller.rb (lines '5'-'17')
[5] GET: /sessions/new (0 variants): PARAMETERS={url=name=url, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/sessions_controller.rb (lines '6'-'9')
[6] POST: /sessions (0 variants): PARAMETERS={password=name=password, paramType=QUERY_STRING, dataType=STRING, user_id=name=user_id, paramType=SESSION, dataType=STRING, remember_me=name=remember_me, paramType=QUERY_STRING, dataType=STRING, url=name=url, paramType=QUERY_STRING, dataType=STRING, email=name=email, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/sessions_controller.rb (lines '11'-'31')
[7] DELETE: /sessions/{id} (0 variants): PARAMETERS={}; FILE=/app/controllers/sessions_controller.rb (lines '33'-'37')
[8] GET: /users (0 variants): PARAMETERS={}; FILE=/app/controllers/api/v1/users_controller.rb (lines '9'-'11')
[9] GET: /users/{id} (0 variants): PARAMETERS={}; FILE=/app/controllers/api/v1/users_controller.rb (lines '13'-'15')
... snipped ...
[38] GET: /api/v1/mobile/{id} (0 variants): PARAMETERS={id=name=id, paramType=QUERY_STRING, dataType=STRING, class=name=class, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/api/v1/mobile_controller.rb (lines '8'-'13')
[39] GET: / (0 variants): PARAMETERS={url=name=url, paramType=QUERY_STRING, dataType=STRING}; FILE=/app/controllers/sessions_controller.rb (lines '6'-'9')
Generated 40 distinct endpoints with 0 variants for a total of 40 endpoints
Successfully validated serialization for these endpoints
0 endpoints were missing code start line
0 endpoints were missing code end line
0 endpoints had the same code start and end line
Generated 36 distinct parameters
Generated 36 total parameters
- 36/36 have their data type
- 0/36 have a list of accepted values
- 36/36 have their parameter type
--- QUERY_STRING: 35
--- SESSION: 1
Finished endpoint detection for '<...>/railsgoat'
----------
-- DONE --
0 projects had duplicate endpoints
Generated 40 distinct endpoints
Generated 40 total endpoints
Generated 36 distinct parameters
Generated 36 total parameters
1/1 projects had endpoints generated
To enable logging include the -debug argument
```

Флаг `-json` также позволяет сформировать выходной файл JSON, который могут использовать плагины ZAP и Burp Suite. Подробнее см. по следующим ссылкам.

- [Страница плагина ASD для OWASP ZAP](https://github.com/secdec/attack-surface-detector-zap/wiki)
- [Страница плагина ASD для PortSwigger Burp](https://github.com/secdec/attack-surface-detector-burp/wiki)

## Инструменты

- [OWASP Zed Attack Proxy (ZAP)](https://www.zaproxy.org/)
- [Burp Suite](https://www.portswigger.net/burp/)
- [Fiddler](https://www.telerik.com/fiddler)

## Источники

- [RFC 2616 — протокол передачи гипертекста — HTTP 1.1](https://tools.ietf.org/html/rfc2616)
- [OWASP Attack Surface Detector](https://owasp.org/www-project-attack-surface-detector/)
