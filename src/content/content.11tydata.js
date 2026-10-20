// content/*.md are data, not pages: they render into collections on the index
// and publications pages. Without this, Eleventy emits a standalone HTML page
// per news item and paper under /content/... (10 stray pages).
module.exports = {
    permalink: false,
};
