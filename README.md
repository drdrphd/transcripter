# transcripter
HTML transcript generator from ELAN files as used on [chachalani.com](https://chachalani.com/)

Online at [guamlinguistics.com/excerpter/](https://guamlinguistics.com/excerpter/)

# About
I was unhappy with the way that ELAN exports to web (using tables and fixed width lines). For mobile, which is most people visiting our sites, I wanted something that would line-wrap appropriately but would still have time-aligned blocks.

This is the result. It's a little clunky as it uses pretty deep nesting of divs, but it does provide the appropriate line-wrapping. It's also possible to easily show and hide tiers as each tier has its own CSS class.

Runs off of the related [WebELAN](https://github.com/drdrphd/WebELAN) JS libary that I'm working on. A bit slow at the moment, but hoping to make that faster in the future.

Links on morphemes are currently using a Wikipedia-style markup of [[link]], which is what we use internally on diksionariu.com (which provides the lookups).
