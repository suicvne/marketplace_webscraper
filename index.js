const { exec } = require('child_process');
const puppeteer = require('puppeteer');

// const this_url = 'https://www.facebook.com/marketplace/orlando/search?query=e320%20cdi%20';
const this_url = 'https://www.facebook.com/marketplace/orlando/search?query=sprinter';
const base_url = 'https://www.facebook.com/marketplace/orlando/';

async function makeMarketplaceURLBySearch(search_query)
{
    return new URL(base_url + `search?query=${encodeURIComponent(search_query)}`);
}

async function getSearchTermByURL(url)
{
    if(url === undefined) return undefined;

    let searchParams = url.searchParams;
    return searchParams.get('query')
}

async function generateHTMLOutput(fb_input_arr) {
    const cheerio = require('cheerio');

    const $ = cheerio.load("<body>");
    $("head").append('<link rel="stylesheet" href="style.css">');

    $("body").append('<div id="query">').add(`<p>Insert Query Here</p>`)

    function makeFbView(input_fb)
    { 
        let a = $(`<div class="listing_view" ><a target="_blank" href="${input_fb.listing_url}"><div class="center"><img src='${input_fb.listing_thumbnail}'></div><h3>${input_fb.listing_title}</h3><h4>${input_fb.listing_price}</h4></div></a>`);
        return a;
    }

    $("body").append('<div id="listings_parent">')

    fb_input_arr.forEach((e, i) =>
    {
        $("#listings_parent").append(makeFbView(e));
    });

    return $.html();
}

async function extractListings(page, filter) {
    console.log("[extractListings]", typeof(filter));
    return await page.evaluate(async (_filter) =>
    {
        console.log("[extractListings page.evaluate]", typeof(filter));
        class FbMarketplaceListing {
            constructor(listing_dom_parent) {

                function _extract_from(listing_dom_parent, selector) {
                    let c = listing_dom_parent.querySelector(selector);
                    return (c !== undefined && c !== null) ? c.innerHTML : "N/A";
                }
    
                function _extract_href_from(listing_dom_parent, selector) {
                    let c = listing_dom_parent.querySelector(selector);
                    return (c !== undefined && c !== null) ? c.href : "N/A";
                }
    
                function _extract_src_from(listing_dom_parent, selector) {
                    let c = listing_dom_parent.querySelector(selector);
                    return (c !== undefined && c !== null) ? c.src : "N/A";
                }


                const selector_cost = '.d2edcug0.hpfvmrgz.qv66sw1b.c1et5uql.oi732d6d.ik7dh3pa.ht8s03o8.a8c37x1j.fe6kdd0r.mau55g9w.c8b282yb.keod5gw0.nxhoafnm.aigsh9s9.d9wwppkn.iv3no6db.a5q79mjw.g1cxx5fr.lrazzd5p.oo9gr5id';
                const selector_title = '.a8c37x1j.ni8dbmo4.stjgntxs.l9j0dhe7';

                this.listing_price = _extract_from(listing_dom_parent, selector_cost);
                this.listing_title = _extract_from(listing_dom_parent, selector_title);
                this.listing_url = _extract_href_from(listing_dom_parent, 'a');
                this.listing_thumbnail = _extract_src_from(listing_dom_parent, 'img');


                this.description = ""; // Might not be able to get this one 
                // this.listing_url = new URL('');
                // this.listing_thumbnail = new URL('');
            }

        }

        return await new Promise((resolve, reject) => 
        {
            // const filter_regex = _filter;
            // TODO: Troubleshoot why passing this filter in as a parameter gives trouble.
            const filter_regex = /(?<a>\bbluetec\b)|(?<b>\bcdi\b)|(?<c>\bdiesel\b)/i;

            const selector_2 = 'div.b3onmgus.ph5uu5jm.g5gj957u.buofh1pr.cbu4d94t.rj1gh0hx.j83agx80.rq0escxv.fnqts5cd.fo9g3nie.n1dktuyu.e5nlhep0.ecm0bbzt';
            let c = document.querySelectorAll(selector_2);
            let d = [];
            console.log("c.length: ", c.length);

            c.forEach((x, i) => 
            {
                if(x.querySelector('div').children.length == 0)
                {
                    console.log("skipping");
                }
                else
                {
                    let new_listing = new FbMarketplaceListing(x);
                    if(filter_regex !== undefined 
                        && new_listing.listing_title.match(filter_regex) != undefined)
                    {
                        // let matches = new_listing.listing_title.match(filter_regex);
                        // console.log(matches);
                        d.push(new_listing);
                    }
                    else if(filter_regex === undefined) d.push(new_listing); 
                }
            });
            
            resolve(d);
        });
    }, filter);
}

async function autoScroll(page, quick_test_mode) {
    return await page.evaluate(async (_quick_test_mode) =>
    {
        return await new Promise((resolve, reject) => 
        {
            let totalHeight = 0;
            let distance = _quick_test_mode ? 500 : 100;

            var timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight) {
                    console.log("resolving. scrollHeight: ", scrollHeight);
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        })
    }, quick_test_mode);
}

let runTypes =
[
    Full=0,
    ParseJsonOnly=1,
]

let args = 
[
    Help = (args) => 
    {
        console.log("HELP!");
    },
    
    ParseJsonOnly = async (args) =>
    {
        console.log("ParseJsonOnly", args);
        const fs = require('fs');
        let listing_count = await JSON.parse(await fs.readFileSync(args[0]));
        await ExportJson(["--export", listing_count, "skip-json"]);
        if(args.length > 1 && args[1] == 'view')
        {
            const open = require('open');
            open(`file://${process.env.PWD}/test.html`);
        }
    },
    ExportJson = async (args) => 
    {
        const fs = require('fs');
        let listing_count = args[1];
        
        let html_out = await generateHTMLOutput(listing_count);
        fs.writeFileSync('test.html', html_out);

        if(args.length > 2 && args[2] == "skip-json") return;
        fs.writeFileSync('test.json', JSON.stringify(listing_count, undefined, 2));
    },
    FullRun = async (args) => 
    {
        const fs = require('fs');
        const quick_mode = args.includes("quick");
        const basic_filter = args.includes("basic_filter");

        let this_regex = undefined;
        if(basic_filter)
        {
            // Generate a regex filter based on search keywords.

        }

        const browser_instance = await puppeteer.launch(
            {
                headless: false,
                slowMo: 250,
                devtools: true
            }
        );
        const page = await browser_instance.newPage();
        await page.goto(this_url);
        await autoScroll(page, args[0] == "quick");

        
        let preferred_regex = new RegExp('/(?<a>\\bbluetec\\b)|(?<b>\\bcdi\\b)|(?<c>\\bdiesel\\b)/i');
        let listing_count = await extractListings(page, preferred_regex);
        console.log("total listings scraped: ", listing_count.length);
        
    
        
        await ExportJson(["--export", listing_count]);
        // await page.screenshot({path: 'test.png', fullPage: true});
        console.log("All set!");
        await page.close();
        await browser_instance.close();
    }
];

// TODO: Make this much better.
async function execArg(arg) {
    const arg_delim1 = '=';
    const arg_delim2 = ',';

    
    let full_args = arg.split(arg_delim1);
    let params = undefined;
    if(full_args.length > 1) params = full_args[1].split(arg_delim2);

    switch(full_args[0])
    {
        case "--help":
        case "-h":
        case "--helpme":
            await Help(params);
            break;
        case "-j":
        case "--parse-only":
        case "--parse-json":
        case "--json":
            await ParseJsonOnly(params);
            break;
        case "--search":
            console.log(full_args, params);
            console.log("search: ", params[0]);
            await FullRun(["search", params[0]]);
            break;
        case "--quick-test":
            await FullRun(["quick"]);
            break;
        default:
            console.log("\nERROR:", full_args[0], "\nUnknown command. Please check help using '--help'.");
    }
}

async function checkArgv() {
    if(process.argv.length > 2)
    {
        // Check argv.
        for(let i = 2; i < process.argv.length; i++)
        {
            await execArg(process.argv[i]);
        }
    }
    else await FullRun(); // Default run mode.
}

// Async Closure
(async () =>
{
    await checkArgv();   
})();
