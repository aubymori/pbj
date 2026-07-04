const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const nunjucks = require("nunjucks");
const mime = require("mime").default;
const frontMatter = require("front-matter");

class pbj
{
    workingDir = "";
    templateDir = "";
    assetsDir = "";
    debug = false;
    errPage = "";

    pages = [];
    tasks = [];

    constructor(workingDir, outDir = "out")
    {
        this.workingDir = workingDir;
        this.outDir = "out";
        let mode = "";
        if (process.argv.length >= 3)
        {
            mode = process.argv[2].toLowerCase();
        }

        switch (mode)
        {
            case "debug":
                this.debug = true;
            case "":
                break;
            case "serve":
                this._serve();
                break;
        }
    }

    // i hate nodejs
    _kill()
    {
        const stub = (() => this).bind(this);
        this.setTemplateDir = stub;
        this.setAssetsDir = stub;
        this.set404Path = stub;
        this.addPage = stub;
        this.withData = stub;
        this.addTask = stub;
        this.build = stub;
    }

    async _serve()
    {
        this._kill();

        let outDir = path.join(this.workingDir, this.outDir);
        if (!fs.existsSync(outDir) || !fs.lstatSync(outDir).isDirectory())
        {
            throw new Error("Out dir does not exist");
        }

        let notFoundPath = null;
        let notFoundFile = path.join(outDir, "404.md");
        if (fs.existsSync(notFoundFile))
        {
            let content = await fs.promises.readFile(notFoundFile, { encoding: "utf8" });
            let fm = frontMatter(content);
            if (fm.attributes && fm.attributes.permalink)
            {
                notFoundPath = path.join(outDir, fm.attributes.permalink);
                if (!fs.existsSync(notFoundPath))
                {
                    throw new Error("404 page does not exist.");
                }
            }
        }

        console.log("Serving at localhost:8000")

        http.createServer(function(req, res)
        {
            let status = 200;

            let uri = decodeURI(req.url);
            if (uri.endsWith("/"))
            {
                uri += "index.html";
            }

            let filePath = path.join(outDir, uri);
            if (!fs.existsSync(filePath))
            {
                let found = false;
                if (!path.extname(filePath))
                {
                    filePath += ".html";
                    if (fs.existsSync(filePath))
                    {
                        found = true;
                    }
                }
                
                if (!found)
                {
                    status = 404;
                    filePath = notFoundPath;
                }
            }

            let mimeType = "text/html";
            if (filePath)
            {
                mimeType = mime.getType(filePath);
            }

            res.writeHead(status, { "Content-Type": mimeType });
            let stream = fs.createReadStream(filePath);
            stream.pipe(res);
        }).listen(8000);
    }

    setTemplateDir(templateDir)
    {
        this.templateDir = templateDir;
        return this;
    }

    setAssetsDir(assetsDir)
    {
        this.assetsDir = assetsDir;
        return this;
    }

    set404Path(errPage)
    {
        this.errPage = errPage;
        return this;
    }

    addPage(template, dest)
    {
        this.pages.push({
            template,
            dest: dest ?? template,
            data: {}
        });
        return this;
    }

    withData(data)
    {
        this.pages[this.pages.length - 1].data = data;
        return this;
    }

    addTask(name, cb, data)
    {
        this.tasks.push({ name, cb, data });
        return this;
    }

    async _buildPage(page)
    {
        let templatePath = path.join(this.templateDir, page.template + ".html");
        if (!fs.existsSync(templatePath))
        {
            throw new Error(`Template "${page.template}" does not exist`);
        }

        let outPath = path.join(this.outDir, page.dest + ".html");

        let outDir = path.dirname(outPath);
        await fs.promises.mkdir(outDir, { recursive: true });

        let rendered = nunjucks.render(page.template + ".html", page.data);
        await fs.promises.writeFile(outPath, rendered);
        
        console.log(`Page "${page.dest}" built`);
    }

    async build()
    {
        if (!this.templateDir)
        {
            console.log("No templates dir");
            return;
        }

        let templateDir = path.join(this.workingDir, this.templateDir);
        if (!fs.existsSync(templateDir) || !fs.lstatSync(templateDir).isDirectory())
        {
            console.log("Bad templates dir");
            return;
        }

        nunjucks.configure(templateDir);

        let promises = [];
        let outDir = path.join(this.workingDir, this.outDir);

        if (this.assetsDir)
        {
            let assetsDir = path.join(this.workingDir, this.assetsDir);
            if (!fs.existsSync(templateDir) || !fs.lstatSync(templateDir).isDirectory())
            {
                console.log("Bad assets dir");
                return;
            }

            let assetsOutDir = path.join(outDir, this.assetsDir);
            await fs.promises.mkdir(assetsOutDir, { recursive: true });
            promises.push((async function()
            {
                await fs.promises.cp(assetsDir, assetsOutDir, { recursive: true });
                console.log("Assets copied");
            })());
        }

        if (this.errPage)
        {
            let errPage = this.errPage;
            promises.push((async function()
            {
                let outFile = path.join(outDir, "404.md");
                await fs.promises.writeFile(outFile,
                    "---\n" +
                    "permalink: " + errPage + "\n" +
                    "---"
                );
            })());
        }

        let faviconPath = path.join(this.workingDir, "favicon.ico");
        if (fs.existsSync(faviconPath) && !fs.lstatSync(faviconPath).isDirectory())
        {
            let faviconOutPath = path.join(outDir, "favicon.ico");
            promises.push(fs.promises.cp(faviconPath, faviconOutPath));
        }

        this.pages.forEach(page =>
        {
            promises.push(this._buildPage(page));
        });

        this.tasks.forEach(task =>
        {
            promises.push((async function()
            {
                task.cb(task.data);
                console.log(`Task "${task.name}" completed`);
            })());
        });

        await Promise.all(promises);
        console.log("All done");
    }
}

module.exports = pbj;