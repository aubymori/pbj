const fs = require("node:fs");
const path = require("node:path");
const nunjucks = require("nunjucks");

class pbj
{
    workingDir = "";
    templateDir = "";
    assetsDir = "";
    debug = false;

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
                // TODO: Implement.
                break;
        }
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

        let rendered = nunjucks.render(templatePath, page.data);
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

        let promises = [];

        if (this.assetsDir)
        {
            let assetsDir = path.join(this.workingDir, this.assetsDir);
            if (!fs.existsSync(templateDir) || !fs.lstatSync(templateDir).isDirectory())
            {
                console.log("Bad assets dir");
                return;
            }

            let assetsOutDir = path.join(this.outDir, this.assetsDir);
            await fs.promises.mkdir(assetsOutDir, { recursive: true });
            promises.push((async function()
            {
                await fs.promises.cp(assetsDir, assetsOutDir, { recursive: true });
                console.log("Assets copied");
            })());
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

        console.log(promises);

        await Promise.all(promises);
        console.log("All done");
    }
}

module.exports = pbj;