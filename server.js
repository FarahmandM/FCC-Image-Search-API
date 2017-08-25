/*
 * @author Farahmand Moslemi
 */

var express = require('express'), http = require('http'), url = require('url');

// For local tests: http://localhost:13000/
if(!process.env.MONGOURL) {
  var myEnv = require('./.env.js')
  process.env.MONGOURL = myEnv.MONGOURL;
  process.env.GSCEKEY = myEnv.GSCEKEY;
  process.env.GSCECX = myEnv.GSCECX;
  process.env.PORT = 13000;
}

var app = express();
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res) {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'pug');
  res.render('index', {base: 'https://' + req.hostname});
});

app.get('/search/:p', function(req, res) {
  var query = req.params.p,
    offset = url.parse(req.url, true).query.offset,
    googleUrl = '';

  if(offset == undefined)
    offset = 1;
  else
    if(offset != parseInt(offset) || offset < 1 || offset > 91)
      offset = 1;
  googleUrl = 'https://www.googleapis.com/customsearch/v1?key=' + process.env.GSCEKEY + '&cx=' + process.env.GSCECX + '&searchType=image&safe=high&start=' + offset + '&q=' + encodeURIComponent(query);
  //console.log(req.params.p);
  //console.log(offset);
  //console.log(googleUrl);
  require('request')(googleUrl, function (err, response, body) {
    //return res.json(response);

    if (!err && response.statusCode == 200) {
      //return res.json(response);
      //return res.json(JSON.parse(body).items);
      var items = [];
      for (var item of JSON.parse(body).items) {
        items.push(
          {
            "url": item.link,
            "snippet": item.snippet,
            "thumbnail": item.image.thumbnailLink,
            "context": item.image.contextLink
          }
        );
      }
      
      var mongo = require('mongodb').MongoClient;
      mongo.connect(process.env.MONGOURL, function(err, db) {
        var collection = db.collection('searchterms');
        collection.insertOne({term: query, when: new Date().toISOString()}, function(err, data) {
          db.close();
          if(err) throw err;
        });
      });

      return res.json(items);
    } else {
      return res.json({"error": "Sorry, but an error occurred."});
    }
  })
});

app.get('/latest', function(req, res) {
  var mongo = require('mongodb').MongoClient;
  mongo.connect(process.env.MONGOURL, function(err, db) {
    if(err) throw err;
    var collection = db.collection('searchterms');
    collection.find({}, {_id:0, term: 1, when: 1}).sort({_id: -1}).limit(10).toArray(function (err, items) {
      db.close();
      if(err) throw err;
      return res.json(items);
    });
  });
});
app.listen(parseInt(process.env.PORT));