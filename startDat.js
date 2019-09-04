var http = require('http');
var fs = require('fs');
var path = require('path');
var collect = require('collect-stream')
var polo = require('polo');
var ram = require('random-access-memory')
var Cabal = require('cabal-core')
var axios  =require('axios')
var url = require('url');
var randomBytes = require('crypto').randomBytes
var apps = polo({multicast: true});
var Dat = require('dat-node')
var mkdirp = require('mkdirp')

var address, port

var myDat, peerDats = [], sharedKey, datName

var firstup = true


datName = randomBytes(16).toString('hex')
var infolder = path.join(__dirname, '/tmp/'+datName+'/in')
var outfolder = path.join(__dirname, '/tmp/'+datName+'/out')
mkdirp.sync(infolder)
mkdirp.sync(outfolder)
fs.writeFileSync(outfolder+'/first.txt', 'hello from '+datName)

var server = http.createServer(function(req, res) {
    if (req.url === '/') {
        res.end('hello-http is available at http://'+apps.get('hello-http').address);
    } else if(req.url==='/key') {
        res.end(datName+","+sharedKey)
    } else {// /?msg=words
        var q = url.parse(req.url, true).query;
        var msg = q.msg
        var ramdonFn = randomBytes(16).toString('hex')
        fs.writeFileSync(outfolder+'/'+ramdonFn+'txt', msg)
        myDat.importFiles(outfolder, function (err) {
            console.log('done importing another-dir')
        })
        res.end(msg)
    } 
    
});

apps.on('up', function(name, service) {                   // up fires everytime some service joins
    if(service.port === port) {

        Dat(outfolder, { temp: true }, function (err, dat) {
            if (err) throw err
            myDat = dat
            var network = dat.joinNetwork()
            network.once('connection', function () {
              console.log('Connected')
            })
            sharedKey = dat.key.toString('hex');
            console.log(`Sharing: ${sharedKey}\n`)
            console.log(`datName: ${datName}\n`)

            fs.writeFileSync(outfolder+'/second.txt', 'hello again from '+datName)
            dat.importFiles(outfolder, function (err) {
                console.log('done importing another-dir')
            })
        })
    }
    if(service.port != port) {
        axios.get('http://' + service.host+":"+service.port+"/key")
            .then(function (response) {
                if(response.data!=='') {
                    var array = response.data.split(',')
                    var foreignDatName = array[0];
                    var foreignSharedKey = array[1];
                    var foreignInFolder = path.join(__dirname, '/tmp/'+datName+'/in/'+foreignDatName)
                    mkdirp.sync(foreignInFolder)
                    Dat(foreignInFolder, { key: foreignSharedKey }, function (err, dat) {
                        if (err) throw err
                        peerDats.push(dat)
                        var network = dat.joinNetwork()
                        network.once('connection', function () {
                          
                        })

                        console.log(`Sharing: ${dat.key.toString('hex')}\n`)
                    })
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






