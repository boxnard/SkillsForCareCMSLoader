
const fs = require('fs');
const csv = require('fast-csv');
const request = require('request');
const budi = require('./BUDI').BUDI;
const argv = require('minimist')(process.argv.slice(2));

const baseURL = 'http://ec2-34-255-118-188.eu-west-1.compute.amazonaws.com:1337';
const loginURL = baseURL+'/auth/local';

let localHeaders={
  qualifications: ['ID','Seq','Group','Title','Code',
                   'From','Until','Level','MultipleLevel',
				   'RelevantToSocialCare','AnalysisFileCode'],
  countries: ['ID','Seq','Country'],
  nationalities: ['ID','Seq','Nationality']
};

let filenames={
  qualifications: 'ascwds-qualifications.csv',
  countries: 'ascwds-countries.csv',
  nationalities: 'ascwds-nationalities.csv'
};

let transforms={
  qualifications: data => ({
	  ID: parseInt(data.ID),
	  Seq: parseInt(data.Seq),
	  Group: data.Group,
	  Title: data.Title,
	  Code: data.Code,
	  From: data.From,
	  Until: data.Until,
	  Level: data.Level,
	  MultipleLevel: data.MultipleLevel.toLowerCase() === 'true',
	  RelevantToSocialCare: data.RelevantToSocialCare.toLowerCase() === 'true',
	  AnalysisFileCode: data.AnalysisFileCode,
	  BUDI: budi.qualifications(budi.FROM_ASC,data.ID)
	  }),
	nationalities: data => ({
	  ID: parseInt(data.ID),
	  Seq: parseInt(data.Seq),
	  Nationality: data.Nationality,
	  BUDI: budi.nationality(budi.FROM_ASC,data.ID)
	}),
	countries: data => ({
		ID: parseInt(data.ID),
		Seq: parseInt(data.Seq),
		Country: data.Country,
		BUDI: budi.country(budi.FROM_ASC,data.ID)
	  })
};

let postUrls = {
	qualifications: baseURL+'/qualifications',
	nationalities: baseURL+'/nationalities',
	countries: baseURL+'/countries'
};

function doItem(token, row) {
	console.log(row);
	
	postItem(postUrls[argv.fn],token,row)
	  .catch(function(reason) { console.log("postItem Promise Rejected "+reason);});
}

async function getToken(loginURL) {
	return new Promise((resolve, reject) => {

		request.post(loginURL,
	               {json: true, body: {identifier: argv.username, password: argv.password} },
				   function(err,res, body) {

					if (err) reject(err);
    		        if (res.statusCode != 200) {
            		    reject('Invalid status code <' + res.statusCode + '>');
            		}
            		resolve(body.jwt);
	  });
	});
}

function postItem(itemURL, token, row)
{
//    console.dir(row);
	return new Promise((resolve, reject) => {
  	  request.post(itemURL, {json: true, body: row, auth: { bearer: token } }, function(err,res, body) {
            if (err) {
	  	        console.log('err POSTed '+JSON.stringify(row));
				reject(err);
			}
			
            if (res.statusCode != 200) {
	  	        console.log('!200 POSTed '+JSON.stringify(row));
                reject('Invalid status code <' + res.statusCode + '>');
            }
            resolve(body);
	  });
	});
}

function parseFile(token)
{
	console.log(argv.noheader);
	const headers={ headers: localHeaders[argv.fn], renameHeaders:(!argv.noheader) };
	console.log('Header info '+JSON.stringify(headers));

	fs.createReadStream(filenames[argv.fn])
	  .pipe(csv.parse(headers)
		.transform(transforms[argv.fn])
		.on('error', error => console.error(error))
		.on('data', row => doItem(token, row))
		.on('end', rowCount => console.log(`Parsed ${rowCount} rows`)));
}

function main()
{
    if(!argv.fn || !argv.username|| !argv.password) {
		console.log("usage: --fn=<object type> --username=<strapi username> --password=<strapi password> [--noheader]");
		console.log("  <object type> := [qualifications|countries|nationalities]");
		return;
	}
	getToken(loginURL)
	  .then(parseFile)
	  .catch(function(reason) { console.log("Promise Rejected "+reason);});
}

main();
