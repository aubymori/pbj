# pbj
Simple static site builder. You can use like this:

```js
#!/usr/bin/env node
const pbj = require("@aubymori/pbj");

new pbj(__dirname)
    .setTemplateDir("templates")
    .setAssetsDir("assets")
    .addPage("index")
    .addPage("source", "dest").withData({ hello: "world" })
    .build();
```

Uses nunjucks for page templating.