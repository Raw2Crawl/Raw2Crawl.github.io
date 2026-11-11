# B. Ресурсы и инструменты для тестирования

## Введение

Данное приложение содержит перечень распространенных инструментов, применяемых при тестировании безопасности веб-приложений. Раздел не претендует на статус исчерпывающего справочника по утилитам, а включение того или иного инструмента не должно рассматриваться как официальная рекомендация со стороны OWASP.

В список включены исключительно инструменты, доступные для бесплатной загрузки и использования (хотя некоторые из них могут содержать лицензионные ограничения на коммерческое применение).

## Общее тестирование веб-приложений

### Веб-прокси

- [ZAP](https://www.zaproxy.org)
    - Zed Attack Proxy (ZAP) — простой в использовании интегрированный инструмент тестирования на проникновение для поиска уязвимостей в веб-приложениях. Он рассчитан на специалистов с самым разным уровнем подготовки в области безопасности и поэтому идеально подходит для разработчиков и функциональных тестировщиков, только начинающих знакомство с пентестом.
        - ZAP включает в себя сканеры автоматизированного аудита, а также набор утилит для ручного поиска уязвимостей безопасности.
- [Burp Suite Community Edition](https://portswigger.net/burp/communitydownload)
    - Burp Suite — перехватывающий прокси-сервер (intercepting proxy) для тестирования безопасности. Позволяет перехватывать и модифицировать весь двусторонний HTTP(S)-трафик, поддерживает работу с пользовательскими сертификатами TLS и клиентами без встроенной поддержки прокси.
- [Telerik Fiddler](https://www.telerik.com/fiddler)
    - Fiddler — перехватывающий веб-прокси, ориентированный главным образом на разработчиков, а не на пентестеров, но тем не менее предоставляющий полезную функциональность. Он напрямую перехватывает вызовы Windows HTTP API, позволяя анализировать трафик программного обеспечения, не имеющего штатных настроек для указания прокси-сервера.
- [Gori](https://github.com/hahwul/gori)
    - Gori — перехватывающий прокси с управлением через терминальный пользовательский интерфейс (TUI) с вкладками истории, репитера и фаззера, повтора проверок контроля доступа, анализа JWT и сессионных токенов, а также внеполосного тестирования (out-of-band). Проект поддерживает написание скриптов через команду `gori run` и доступен для инструментов ИИ через сервер Model Context Protocol (MCP).

### Расширения Firefox

- [Firefox HTTP Header Live](https://addons.mozilla.org/en-US/firefox/addon/http-header-live)
    - Просмотр HTTP-заголовков страницы непосредственно в процессе навигации в браузере.
- [Firefox Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers/)
    - Создание изолированных контейнеров, каждый из которых имеет собственное изолированное хранилище cookie и сессий. Удобно для проверки разграничения доступа между различными учетными записями.
- [Firefox Web Developer](https://addons.mozilla.org/en-US/firefox/addon/web-developer/)
    - Расширение Web Developer добавляет в браузер набор инструментов для веб-разработчиков.

### Расширения Chrome

- [Chrome Web Developer](https://chromewebstore.google.com/detail/bfbameneiokkgbdmiekhjnmfkcnldhhm)
    - Добавляет панель с разнообразными инструментами веб-разработки. Это официальный порт расширения Web Developer для Google Chrome.
- [Cookie Editor](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)
    - Мощное и простое расширение, позволяющее быстро создавать, редактировать и удалять файлы cookie для текущей вкладки. Полезно при разработке, тестировании и ручном управлении сессиями.

### Конкретные уязвимости

#### SQL-инъекция (SQL Injection)

- [sqlmap](https://sqlmap.org)

#### TLS

- [OWASP O-Saft](https://owasp.org/www-project-o-saft/)
- [sslyze](https://github.com/nabla-c0d3/sslyze)
- [testssl.sh](https://github.com/drwetter/testssl.sh)
- [SSLScan](https://github.com/rbsec/sslscan)
- [SSLLabs](https://www.ssllabs.com/ssltest/)

#### Атаки методом полного перебора

##### Инструменты взлома хешей

- [John the Ripper](https://github.com/openwall/john)
- [hashcat](https://hashcat.net/hashcat/)

##### Удаленный подбор методом грубой силы (Brute Force)

- [ZAP](https://www.zaproxy.org)
- [Patator](https://github.com/lanjelot/patator)
- [THC Hydra](https://github.com/vanhauser-thc/thc-hydra)
- [Burp Suite Community Edition (Intruder)](https://portswigger.net/burp/communitydownload)

#### Фаззеры

- [Ffuf](https://github.com/ffuf/ffuf)
- [Wfuzz](https://github.com/xmendez/wfuzz)
- [Jdam](https://gitlab.com/michenriksen/jdam)

#### Google Hacking

- [Google Hacking database](https://www.exploit-db.com/google-hacking-database/)

#### Атаки Slow HTTP

- [Slowloris](https://github.com/gkbrk/slowloris)
- [slowhttptest](https://github.com/shekyan/slowhttptest)

### Зеркалирование сайта

- [wget](https://www.gnu.org/software/wget)
- [curl](https://curl.se)

### Обнаружение контента

- [Gobuster](https://github.com/OJ/gobuster)
- [Waybackurls](https://github.com/tomnomnom/waybackurls)
    - Waybackurls извлекает все URL-адреса, сохраненные сервисом Wayback Machine для заданного домена; полезно на этапе разведки.
    - **Использование:**

```bash
waybackurls example.com
```

- [GAU (Get All URLs)](https://github.com/lc/gau)
    - GAU собирает URL-адреса из множества публичных веб-архивов, включая Wayback Machine и Common Crawl.
    - **Использование:**

```bash
gau example.com
```

- [Unfurl](https://github.com/tomnomnom/unfurl)
    - Unfurl извлекает поддомены, пути и параметры из списков URL-адресов для более глубокого анализа.
    - **Использование:**

```bash
unfurl "https://example.com/page?query=123"
```

### Обнаружение поверхности атаки

- [OWASP Noir](https://github.com/owasp-noir/noir)
    - Noir выполняет статический анализ исходного кода для формирования перечня эндпоинтов, HTTP-методов и параметров для множества языков и фреймворков. Выводит результаты в виде простого текста, JSON, спецификаций OpenAPI или команд curl, а также позволяет воспроизводить обнаруженные эндпоинты через ZAP или Burp Suite.
- [OWASP Attack Surface Detector](https://owasp.org/projects/attack-surface-detector)
    - Attack Surface Detector использует статический анализ кода для выявления эндпоинтов и параметров; доступен в виде консольной утилиты и плагинов для ZAP и Burp Suite.

### Обнаружение портов и сервисов

- [Nmap](https://nmap.org/)

## Сканеры уязвимостей

- [ZAP](https://www.zaproxy.org)
- [Nikto](https://cirt.net/Nikto2)
- [Nuclei](https://nuclei.projectdiscovery.io/)
- [SecOps Solution](https://secopsolution.com)

## Фреймворки эксплуатации

- [Metasploit](https://github.com/rapid7/metasploit-framework)
- [BeEF](https://github.com/beefproject/beef/)

## Дистрибутивы Linux

- [Kali](https://www.kali.org)
- [Parrot](https://www.parrotsec.org)
- [Samurai](https://github.com/SamuraiWTF/samuraiwtf)
- [Santoku](https://sourceforge.net/projects/santoku/)
- [BlackArch](https://blackarch.org/downloads.html)

## Анализаторы исходного кода

- [Spotbugs](https://spotbugs.github.io)
- [Find Security Bugs](https://find-sec-bugs.github.io)
- [phpcs-security-audit](https://github.com/squizlabs/PHP_CodeSniffer)
- [PMD](https://pmd.github.io)
- [Microsoft's .NET Analyzers](https://learn.microsoft.com/en-us/visualstudio/code-quality/install-net-analyzers)
- [SonarQube Community Edition](https://www.sonarsource.com/products/sonarqube/)

## Инструменты автоматизации браузера

Инструменты автоматизации браузера применяются для проверки функциональности веб-приложений. Некоторые из них построены на базе скриптового подхода и обычно используют фреймворки модульного тестирования (Unit Testing) для формирования тестовых наборов и сценариев. Большинство, если не все, могут быть адаптированы для проведения проверок безопасности в дополнение к функциональным тестам.

### Инструменты с открытым исходным кодом

- [HtmlUnit](https://htmlunit.sourceforge.io) — браузер без графического интерфейса (headless) для Java-программ. Он моделирует документы HTML и предоставляет API для запроса страниц, заполнения форм, перехода по ссылкам и взаимодействия с JavaScript и сложными библиотеками AJAX. Может имитировать Chrome, Firefox или Edge в зависимости от конфигурации; обычно применяется для автоматизированного тестирования или веб-скрейпинга. HtmlUnit также может использоваться как совместимый с Selenium браузер через драйвер [htmlunit-driver](https://github.com/SeleniumHQ/htmlunit-driver). Последний стабильный релиз — 4.21.0 (`org.htmlunit:htmlunit:4.21.0`).
    - Репозиторий GitHub: [HtmlUnit/htmlunit](https://github.com/HtmlUnit/htmlunit)
- [Selenium](https://www.selenium.dev)
    - Фреймворк тестирования на базе JavaScript, кроссплатформенный, предоставляет графический интерфейс для создания тестов.

## Онлайн-ресурсы для сравнения инструментов тестирования безопасности

Помимо отдельных утилит, перечисленных в данном приложении, специалистам часто требуются ресурсы для сопоставления и сравнительной оценки инструментов тестирования безопасности по различным категориям, таким как SAST, DAST, SCA и безопасность API.

Следующие бесплатные ресурсы содержат структурированные сравнительные обзоры и руководства по оценке.

### Сравнение инструментов AppSec Santa

- [AppSec Santa](https://appsecsanta.com)
    - Курируемая база сравнения более чем 160 инструментов безопасности приложений по таким категориям, как SAST, DAST, SCA, безопасность API, безопасность контейнеров и др.

### Анализатор заголовков безопасности

- [SecurityHeaders](https://securityheaders.com)
    - Бесплатный онлайн-инструмент, анализирующий заголовки HTTP-ответов и выявляющий отсутствующие или некорректно настроенные механизмы безопасности, такие как Content Security Policy, HSTS и X-Frame-Options.

### Документация ZAP (Zed Attack Proxy)

Официальная документация и обучающие материалы по инструменту динамического анализа безопасности приложений (Dynamic Application Security Testing, DAST) ZAP (Zed Attack Proxy).

- [ZAP Documentation](https://www.zaproxy.org/docs/)

### Nuclei Templates Project

Крупный открытый репозиторий шаблонов обнаружения уязвимостей, используемый для автоматизированного сканирования безопасности.

- [Nuclei Templates](https://github.com/projectdiscovery/nuclei-templates)
