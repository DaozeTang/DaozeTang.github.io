const path = require("node:path");
const sass = require("sass");
const yaml = require("js-yaml");

module.exports = function (eleventyConfig) {
    eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

    const byDateDesc = (a, b) => b.date - a.date;
    const PUBS_GLOB = "src/content/publications/**/*.md";
    const NEWS_GLOB = "src/content/news/**/*.md";

    eleventyConfig.addCollection("publications", (api) =>
        api.getFilteredByGlob(PUBS_GLOB).sort(byDateDesc)
    );

    eleventyConfig.addCollection("selectedPublications", (api) =>
        api
            .getFilteredByGlob(PUBS_GLOB)
            .filter((item) => item.data.selected === true)
            .sort(byDateDesc)
    );

    eleventyConfig.addCollection("news", (api) =>
        api.getFilteredByGlob(NEWS_GLOB).sort(byDateDesc)
    );

    const groupByYear = (items) => {
        const groups = new Map();
        for (const item of items) {
            const year = String(item.date.getFullYear());
            if (!groups.has(year)) groups.set(year, []);
            groups.get(year).push(item);
        }
        return [...groups.entries()].map(([year, items]) => ({ year, items }));
    };

    eleventyConfig.addCollection("publicationsByYear", (api) =>
        groupByYear(api.getFilteredByGlob(PUBS_GLOB).sort(byDateDesc))
    );

    eleventyConfig.addCollection("newsByYear", (api) =>
        groupByYear(api.getFilteredByGlob(NEWS_GLOB).sort(byDateDesc))
    );

    eleventyConfig.addFilter("encodeEmail", (value) =>
        String(value)
            .split("")
            .map((ch) => "&#" + ch.codePointAt(0) + ";")
            .join("")
    );

    eleventyConfig.addFilter("toFixed", (value, digits = 2) =>
        Number(value).toFixed(digits)
    );

    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", {
        outputFileExtension: "css",
        useLayouts: false,
        compile(inputContent, inputPath) {
            const parsed = path.parse(inputPath);
            if (parsed.name.startsWith("_")) return;

            const result = sass.compileString(inputContent, {
                loadPaths: [parsed.dir, "src/styles"],
                style: "compressed",
                sourceMap: false,
            });

            this.addDependencies(inputPath, result.loadedUrls);
            return () => result.css;
        },
    });

    eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
    eleventyConfig.addPassthroughCopy({ "src/assets/documents": "assets/documents" });
    eleventyConfig.addPassthroughCopy({ "src/assets/favicon.png": "favicon.png" });
    eleventyConfig.addPassthroughCopy({ "src/scripts": "scripts" });

    eleventyConfig.setServerOptions({ showAllHosts: true });

    return {
        dir: {
            input: "src",
            includes: "partials",
            layouts: "layouts",
            data: "data",
            output: "_site",
        },
        templateFormats: ["liquid", "md", "html"],
        markdownTemplateEngine: "liquid",
        htmlTemplateEngine: "liquid",
    };
};
