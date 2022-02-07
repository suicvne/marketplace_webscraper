const { ipcRenderer } = require('electron');

let _current_bound_results = [];

function doSearch(quick) {
    console.log('doSearch called.');
    let searchTerm = document.querySelector('#input_search_text');
    console.log("TODO: Search for ", searchTerm.value);

    let o = 
    {
        "search": searchTerm.value,
        "quick": quick
    };

    ipcRenderer.send('do-search', o);
}

function bindEvents() {
    console.log('binding events');
    ipcRenderer.on('waiting-results', (event, args) => {
        console.log("disabling input");
    });

    ipcRenderer.on('search-results', (event, args) => {
        console.log('search-results');
        console.log('results: ', args);
        setSearchingOverlayVisible(false);
        bindSearchResultsToFrontend(args);
    });

    ipcRenderer.on('base-search-url', (event, args) => {
        document.querySelector("#base_url").innerHTML = `search base: ${args}`;
    });
}
bindEvents();

function askShellOpen(url) {
    ipcRenderer.send('open-link-newwin', url);
}

function getYearMinMax() {
    let use = document.querySelector("#input_use_year_filter").checked;
    console.log("use filter", use);
    let min = Number(document.querySelector("#input_min_year").value);
    let max = Number(document.querySelector("#input_max_year").value);

    return use ? {"min": min, "max": max, "use": use} : false;
}

function bindSearchResultsToFrontend(search_results) {
    if(search_results === undefined || search_results.length === 0)
    {
        console.log('using new updated filters');
    }
    else
    {
        console.log("binding results: ", search_results.length);
        _current_bound_results = search_results;
    }

    let yr_filter = getYearMinMax();
    console.log("year filter: ", yr_filter);

    function isInRange(x, min, max) {
        return x <= max && x >= min;
    }

    function removeAllChildNodes(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    removeAllChildNodes(document.querySelector('#search_results'));
    
    _current_bound_results.forEach((x, i) =>
    {
        // Clone template
        
        let doAdd = true;
        if(x.listing_model_year && yr_filter !== false)
        {
            doAdd = isInRange(x.listing_model_year, yr_filter["min"], yr_filter["max"]);
        }

        if(doAdd)
        {
            let new_template = document.querySelector("#search_template").cloneNode(true);
            new_template.style.display = 'block'; // Ensure it's shown.
            new_template.id = ''; // Remove template ID.
            // x.listing_price
            // x.listing_title
            // x.listing_thumbnail
            // x.listing_url

            // Bind
            // new_template.querySelector("a").href = `javascript:askShellOpen('${x.listing_url}');`;

            function _a(u) {
                askShellOpen(u);
            }
            new_template.addEventListener('click', () => _a(x.listing_url));

            

            new_template.querySelector("#search_result_image").src = x.listing_thumbnail;
            new_template.querySelector("#search_result_title").innerHTML = x.listing_title;
            new_template.querySelector("#search_result_price").innerHTML = x.listing_price;

            // Append
            document.querySelector("#search_results").appendChild(new_template);
        }
    });
}

function writeSettings() {
    window.localStorage.setItem('use', document.querySelector('#input_use_year_filter').checked);
    window.localStorage.setItem('min', document.querySelector("#input_min_year").value);
    window.localStorage.setItem('max', document.querySelector("#input_max_year").value);
    window.localStorage.setItem('last_query', document.querySelector("#input_search_text").value);
}

function getSettings() {
    let a = 
    {
        "use": window.localStorage.getItem('use'),
        "min": window.localStorage.getItem('min'),
        "max": window.localStorage.getItem('max'),
        "last_query": window.localStorage.getItem('last_query')
    };

    return a;
}

function updateFilterDefaults() {
    let settings = getSettings();

    document.querySelector('#input_use_year_filter').checked = settings.use;
    document.querySelector("#input_min_year").value = settings.min;
    document.querySelector("#input_max_year").value = settings.max;
    document.querySelector("#input_search_text").value = settings.last_query;

}

function setSearchingOverlayVisible(visible) {
    document.querySelector('.overlay').style.display = visible ? 'block' : 'none';
}

window.addEventListener('beforeunload', () => writeSettings());

window.addEventListener('DOMContentLoaded', () => {

    updateFilterDefaults();

    document.querySelector('#input_search_submit').addEventListener('click', () =>
    {
        setSearchingOverlayVisible(true);
        doSearch(false);
    });

    document.querySelector('#input_search_submit_quick').addEventListener('click', () =>
    {
        setSearchingOverlayVisible(true);
        doSearch(true);
    });

    document.querySelector("#input_filter").addEventListener('click', () => {
        writeSettings(); // Write settings
        bindSearchResultsToFrontend(undefined); // Bind search results with filter. No need to requery for this.
    });

    ipcRenderer.send('frontend-ready');
});