let isDarkMode = localStorage.getItem('isDarkMode') == 'true' ? true : false;
if(isDarkMode){
	document.getElementsByTagName('html')[0].setAttribute('id','dark');
}
else{
	document.getElementsByTagName('html')[0].setAttribute('id','light');
}

let l10n = localStorage.getItem('l10n') != null ? localStorage.getItem('l10n') : 'en';

if(localStorage.getItem('l10n') == null){
	//try to set from environment
	let lang = process.env.LANG;
	if(typeof lang != "undefined"){
		if(lang.indexOf('en') == 0){
			l10n = 'en';
		}
		if(lang.indexOf('zh') == 0){
			l10n = 'cn';
		}
	}
	localStorage.setItem('l10n',l10n);
}

let ifs = require('fs');

const l10n_csv = ifs.readFileSync(nw.__dirname+'/js/l10n.csv','utf8');

let l10nData = {};
let csvData = l10n_csv.split('\n');
let keys = csvData[0].split(',');

csvData.slice(1).map(line=>{
	let cells = line.split(',');
	let elemKey = cells[0];
	l10nData[elemKey] = {};
	cells.slice(1).map((val,i)=>{
		l10nData[elemKey][keys[i+1]] = val.replace(/"/gi,"");
	})
})
localStorage.setItem('l10nData',JSON.stringify(l10nData));
