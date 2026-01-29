$(function () {
    if (!$.pjax) {
        return;
    }

    const pjaxContainer = "#pjax-container";

    $(document).on("click", "a[href]:not([data-no-pjax])", function (event) {
        const link = event.currentTarget;
        const href = link.getAttribute("href");

        if (!href || href.startsWith("#")) {
            return;
        }

        if (link.target || link.hasAttribute("download")) {
            return;
        }

        if (href.startsWith("mailto:") || href.startsWith("tel:")) {
            return;
        }

        if (link.origin && link.origin !== window.location.origin) {
            return;
        }

        $.pjax.click(event, {
            container: pjaxContainer,
            fragment: pjaxContainer,
            timeout: 8000,
            scrollTo: 0
        });
    });

    $(document).on("pjax:complete", function () {
        const currentPath = window.location.pathname.replace(/\/$/, "");
        $(".navbar-nav .nav-item").removeClass("active");
        $(".navbar-nav .nav-link").each(function () {
            const linkPath = new URL(this.href, window.location.origin).pathname.replace(/\/$/, "");
            if (linkPath === currentPath) {
                $(this).closest(".nav-item").addClass("active");
            }
        });

        if (typeof window.initializeCommonScripts === "function") {
            window.initializeCommonScripts();
        }

        if (typeof window.renderPageMath === "function") {
            window.renderPageMath();
        }

        if (typeof window.renderBubbleVisualHashes === "function") {
            window.renderBubbleVisualHashes();
        }

        if (typeof window.refreshSemanticScholarCitationCounts === "function") {
            window.refreshSemanticScholarCitationCounts();
        }
    });
});
