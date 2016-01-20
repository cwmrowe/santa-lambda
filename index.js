console.log('Loading function!!!!');

var im = require('imagemagick');
var aws = require('aws-sdk');
var s3 = new aws.S3({ apiVersion: '2006-03-01' });
var fs = require('fs');
var gm = require('gm').subClass({imageMagick: true});
var Promise = require('promise');
var cv = require('opencv');

var context, bucket, key;
var sourceDir = 'originals/';
var transformedDir = 'transformed/';

var readFile = Promise.denodeify(fs.readFile); 

var getImage = function(){
    var params = {
        Bucket: bucket,
        Key: key
    };
    console.log('Get Image Params:', JSON.stringify(params, null, 2));
    s3.getObject(params, function(err, data) {
        if (err) {
            console.log(err);
            var message = "Error getting object " + key + " from bucket " + bucket +
                ". Make sure they exist and your bucket is in the same region as this function.";
            console.log(message);
            context.fail(message);
        } else {
            console.log('CONTENT TYPE:', data.ContentType);
            console.log('CONTENT LENGTH:', data.ContentLength);
            convertImage(data.Body);
        }
    });
}

var addHat = function(imageBuffer, face){

    var hatSize = face.width * 1.3;

    var y = face.y + (face.height * 0.2) - hatSize;
    if(y < 0){
        y = y.toString();
    }else{
        y = '+' + y;
    }
    var x = face.x - (face.width * 0.15);
    if(x < 0){
        x = x.toString();
    }else{
        x = '+' + x;
    }

    var geometry = hatSize + 'x' + hatSize + x + y;

    console.log('geometry: ', geometry);

    return new Promise(function (resolve, reject) {
        

        gm(imageBuffer)
        //.resize(200, 200)
        .composite('santahat.png')
        .geometry(geometry)
        .toBuffer(function(err, buffer){
          if (err){
            console.log('Add santa hat fail', err);
            reject(err);
          }else{
            resolve(buffer);
          }
        });


    });
}

var convertImage = function(imageBody){
    console.log('Convert Image');

    cv.readImage(imageBody, function(err, im){
      if (err){
            ontext.fail("CV FAIL READ IMAGE");
       }
      if (im.width() < 1 || im.height() < 1) throw new Error('Image has no size');

      im.detectObject("node_modules/opencv/data/haarcascade_frontalface_alt.xml", {}, function(err, faces){
        if (err){
            context.fail("CV FAIL DETECT");
        }

        console.log('Faces found: ', faces.length);

        var lastPromise;

        faces.forEach(function(face){

            if(lastPromise){
                lastPromise = lastPromise.then(function(imageBuffer){
                    return addHat(imageBuffer, face);
                });
            }else{
                lastPromise = addHat(imageBody, face);
            }

        });

        lastPromise.then(function(imageBuffer){
            console.log('last promise done');
            saveImage(imageBuffer);
        }, function(err){
            context.fail("ADD HAT FAIL");
        });

      });
    });
    
    
}

var saveImage = function(imageBody){
    console.log('Save Image');

    var filename = key.substr(sourceDir.length, key.length - sourceDir.length);
    var location = transformedDir + filename;

    var params = {
        Bucket: bucket,
        Key: location,
        Body: imageBody
    };
    s3.putObject(params, function(err, data){
        if(err){
            console.log(err);
            context.fail("Failed to save " + location);
        }else{
            context.succeed('Done: ' + location);
        }
    })
};

exports.handler = function(event, c) {
    context = c;
    //console.log('Received event:', JSON.stringify(event, null, 2));
 
    // Get the object from the event and show its content type
    bucket = event.Records[0].s3.bucket.name;
    key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    getImage();
};