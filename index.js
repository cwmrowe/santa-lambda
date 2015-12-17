console.log('Loading function!!!!');

var im = require('imagemagick');
var aws = require('aws-sdk');
var s3 = new aws.S3({ apiVersion: '2006-03-01' });
var fs = require('fs');
var gm = require('gm').subClass({imageMagick: true});
var Promise = require('promise');

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

var convertImage = function(imageBody){
    console.log('Convert Image');

    gm(imageBody)
        .composite('santahat.png')
        .geometry('+100+150')
        //.resize(200, 200)
        .toBuffer(function(err, buffer){
            if (err){
            context.fail("GM FAIL");
          }else{
            saveImage(buffer);
          }
        });

    // readFile('santahat.png').then(function(fileContents){
    //     console.log('santa hat loaded');
        

    // }, function(err){
    //     console.log(err);
    // });
    
    
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