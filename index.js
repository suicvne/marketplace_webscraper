/**
 * Electron Bootstrap Commands.
 * 
 * This is our main entry point.
 */

/**
 * 
 * Flow.
 * 
 * ipc will be used.
 * 
 * Frontend -> Search Clicked -> Search Term sent to scraper -> Scraper works -> Scraper sends notification when done -> Frontend gets message -> frontend updates.
 * 
 * 
 */



const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { async_doScrape, base_url } = require('./scraper.js');
const path = require('path');
const fs = require('fs');

ipc_active = false;

async function frontendReady_checkResults(event) {
    if(fs.existsSync('test.json'))
    {
        console.log('using existing file. sending it to frontend');
        let read_file = fs.readFileSync('test.json');
        let parsed_object = JSON.parse(read_file);
        event.sender.send('search-results', parsed_object);
        event.sender.send('base-search-url', base_url);
    }
}

function writeTestJson(args)
{
    fs.writeFileSync('test.json', JSON.stringify(args, null, 4));
}

async function setupIpcHandlers() {
    ipc_active = true;
    console.log('setupIpcHandlers');
    ipcMain.on('do-search', async (event, args) => {
        console.log('do-search. args: ', args);
        let res = await async_doScrape(args);
        console.log('scrape results: ', res.length);
        
        console.log('sending search-results');
        event.sender.send('search-results', res);

        writeTestJson(res);
    });

    ipcMain.on('frontend-ready', async(event, args) => {
        frontendReady_checkResults(event);
    });

    ipcMain.on('open-link-newwin', async(event, args) => {
        if(args !== undefined && args.length > 0 && args.length < 512)
            shell.openExternal(args);
        else
            console.log("potentially bad URL: ", args);
    });
}

 const createWindow = async () => {
     const win = new BrowserWindow({
         width: 800,
         height: 600,
         webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, '/frontend_index_preload.js')
        }
     });

     win.loadFile('frontend_index.html');
 };

 app.on('window-all-closed', async () =>
 {
     // Quit if the last window is closed on any platform EXCEPT
     // macOS/darwin
     if (process.platform !== 'darwin') app.quit();
 });

 app.whenReady().then(async () =>
 {
    if(ipc_active === false)
        await setupIpcHandlers();
    
    createWindow();

    // Show new window is we activate and have no windows.
    app.on('activate', () => {
        if(BrowserWindow.getAllWindows().length === 0) createWindow();
    });
 });