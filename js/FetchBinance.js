/*
    [Helper] 
*/
const sleep = (ms = 60000) => 
    new Promise(resolve => setTimeout(resolve, ms));

//  將 UNIX Time 轉換成 "yyyy-MM-dd hh:mm:ss" 格式
const unixToDate = (str) => 
    new Date(Number(str)).toISOString().substring(0, 19).replace('T', ' ');

//  位移時間 （時間框 * limit）
const intervalOffest = (str = "1d", step = 1) => {
    /*  [幣安支援時間框的格式]

        1m, 3m, 5m, 15m, 30m
        1h, 2h, 4h, 6h, 8h, 12h
        1d, 3d, 1w, 1M
    */

    let offset = 0;
    //  1 minute 
    let m = (60 * 1000);
    //  1 hour
    let h = (60 * m);
    //  1 day
    let d = (24 * h);

    if(str.includes("1w"))
        offset = step * (1 * 7 * d);
    else if(str.includes("d")){
        let days = parseInt(str.replace(/d/gi, ""));

        offset = step * (days * d);
    }
    else if(str.includes("h")){
        let hours = parseInt(str.replace(/h/gi, ""));

        offset = step * (hours * h);
    }
    else if(str.includes("m")){
        let minutes = parseInt(str.replace(/m/gi, ""));

        offset = step * (minutes * m);
    }

    return offset;
}

const baseUrl = (api = "klines", symbol_type = "SPOT") => {
    if(symbol_type === "SPOT")
        return `https://api.binance.com/api/v3/${api}`;
    else if(symbol_type === "FUTURE")
        return `https://fapi.binance.com/fapi/v3/${api}`;
}

const buildParameter = ({
    symbol, interval, 
    start, end = new Date().getTime(), 
    limit = 1000, 
}) => 
    `?symbol=${symbol}&interval=${interval}&startTime=${start}&endTime=${end}&limit=${limit}`;

const defaultColumns = () => [
    'timestamp',    // open time
    'open', 'high', 'low', 'close', 
    'volume', 
    'close_time', 
    'quote_asset_volume', 
    'trades', 
    'taker_buy_base_asset_volume', 
    'taker_buy_quote_asset_volume', 
];

/*
    [Fetch Data]
*/
const exchangeInfo = async(quote_asset = "USDT") => {
    return new Promise((resolve, reject) => {
        let url = baseUrl("exchangeInfo");

        fetch(url)
            .then(response => response.json())
            .then(json => {
                //  filter pair with "quote_asset"
                json.symbols = [...json.symbols.filter(
                    object => object.symbol.includes(quote_asset)
                )];
                
                resolve(json);
            })
            .catch(err => reject(err));
    });
}

const fetchKline = ({
    symbol, interval = "1d", 
    start = 0, end = new Date().getTime(), limit = 1000, 
}) => {
    return new Promise((resolve, reject) => {
        let parameters = buildParameter({
            symbol, interval, 
            start, end, limit, 
        });
        let url = baseUrl("klines") + parameters;
        
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //  timestamp 和 close_time 轉換成方便閱讀的格式
                for(let i=0; i<json.length; i++){
                    json[i][0] = unixToDate(json[i][0]);
                    json[i][6] = unixToDate(json[i][6]);
                    //  移除最後一個欄位（ignore）
                    json[i].pop();
                }
                
                resolve(json);
            })
            .catch(err => reject(err));
    });
}

const getOnBoard = ({
    symbol, interval = "1m", 
    start = 0, end = new Date().getTime(), 
    limit = 1, 
}) => {
    return new Promise((resolve, reject) => {
        fetchKline({
            symbol, interval, 
            start, end, limit
        })
        .then(json => {
            const start_datetime = json[0][0];
            
            resolve(start_datetime);
        })
        .catch(err => reject(err));
    });
}

const fetchHistory = async({
    symbol, interval = "1d", 
    start = 0, end = new Date().getTime(), 
    limit = 1000, 

    weight = 1, weight_limit = 1200, 
}) => {
    let promise_list = [];
    let offset = intervalOffest(interval, limit);
    let count_weight = 0;

    console.log(`[fetch "${symbol}" start] ${new Date().toISOString()}`);
    while(start <= end){
        promise_list.push(fetchKline({ 
            symbol, interval, 
            start, end, limit, 
        }));

        start += offset;
        count_weight += weight; 

        //  達到 90% 使用的權重額度時，強制暫停1分鐘再繼續
        if(count_weight >= (0.9 * weight_limit)){
            console.log(`[fetch "${symbol}" limit] ${new Date().toISOString()}`);

            await sleep(60000);
            count_weight = 0;
        }
    }
    
    //  全部歷史資料已經載入完畢
    return Promise.all(promise_list)
        .then(response_list => {
            console.log(`[fetch "${symbol}" end] ${new Date().toISOString()}`);
            
            return [...response_list.flat()];
        })
        .catch(err => {
            throw err;
        });
}

window.FetchBinance = {
    baseUrl, buildParameter, defaultColumns, 
    exchangeInfo, 
    getOnBoard, fetchKline, fetchHistory, 
}