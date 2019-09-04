var http = require('http');
var collect = require('collect-stream')
var polo = require('polo');
var ram = require('random-access-memory')
var Cabal = require('cabal-core')
var axios  =require('axios')
var url = require('url');
var randomBytes = require('crypto').randomBytes
var apps = polo({multicast: true});



var address, port

var cabal, sharedKey, localKey, ts

var firstup = true

var server = http.createServer(function(req, res) {
    if (req.url === '/') {
        res.end('hello-http is available at http://'+apps.get('hello-http').address);
    } else if(req.url==='/key') {
        res.end(sharedKey +","+localKey+","+ts|| '')
    } else {// /?msg=words
        var q = url.parse(req.url, true).query;
        cabal.publish({
            type: 'chat/text',
            content: {
                text: q.msg+" from "+port,
                channel: 'general'
            }
        }, ()=>{
            res.end(q.msg)
        })
    } 
    
});

apps.on('up', function(name, service) {                   // up fires everytime some service joins
    if(!sharedKey && service.port === port) {
        var addr = randomBytes(32).toString('hex')
        cabal = Cabal(ram, 'cabal://' + addr)
        cabal.ready(function () {
            cabal.getLocalKey(function (err, key) {
                localKey = key
                sharedKey = cabal.key
                ts = (new Date()).getTime() 
                console.log('gen key: '+sharedKey+","+localKey)

                cabal.publish({
                    type: 'chat/text',
                    content: {
                        text: 'hello from port '+service.port,
                        channel: 'general'
                    }

                })
    
                cabal.messages.events.on('general', function (msg) {
                    // console.log(`my: ${cabal.key}: `+msg.value.content.text)

                    var r1 = cabal.messages.read('general')
                    collect(r1, function (err, data) {
                        data.forEach(element => {
                            console.log(element.value);
                            
                        });
                    })
                    
                })
            });
            


        })
    }
    if(service.port != port) {
        axios.get('http://' + service.host+":"+service.port+"/key")
            .then(function (response) {
                if(response.data!=='') {
                    var arr = response.data.split(',')
                    var ts1 = arr[2]
                    if(parseInt(ts1)>ts) {
                        console.log('reject key: '+response.data);
                        return
                    }
                    cabal = Cabal(ram, 'cabal://' +arr[0], { modKey: arr[1] })
                    
                    cabal.ready(function () {
                        sharedKey = cabal.key.toString('hex')
                        console.log('get key: '+response.data);
                        console.log(sharedKey)
    
                        cabal.publish({
                            type: 'chat/text',
                            content: {
                              text: 'hello from port '+service.port,
                              channel: 'general'
                            }
                        })
    
                        cabal.messages.events.on('general', function (msg) {
                            // console.log(`my: ${cabal.key}: `+msg.value.content.text)
        
                            var r1 = cabal.messages.read('general')
                            collect(r1, function (err, data) {
                                data.forEach(element => {
                                    console.log(element.value);
                                    
                                });
                            })
                            
                        })
                    })
                } else {
                    throw 'need restart for a key'
                }

                
                
            })
            .catch(function (error) {
                // handle error
                console.log(error);
            })
            .finally(function () {
                // always executed
            });
    } 

    console.log(apps.all(name));                        // should print out the joining service, e.g. hello-world
    firstup = false
});


server.listen(0, function() {
    port = server.address().port; // let's find out which port we binded to

    // if(!apps.all('hello-http')) {

    //     cabal = Cabal(ram)
    //     cabal.ready(function () {
    //         sharedKey = cabal.key
    //         console.log('gen key'+sharedKey)

    //         cabal.publish({
    //             type: 'chat/text',
    //             content: {
    //                 text: 'hello from port '+server.address().port,
    //                 channel: 'general'
    //             }
    //         })

    //         cabal.messages.events.on('general', function (msg) {
    //             console.log(`my: `+msg.value.content.text)
    //         })
    //     })
        
    // }
    apps.put({
        name: 'hello-http',
        port: port
    });

    console.log('visit: http://localhost:'+port);
});



