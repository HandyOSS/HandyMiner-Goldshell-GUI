console.log('do themes???');
let isDarkMode = localStorage.getItem('isDarkMode') == 'true' ? true : false;
if(isDarkMode){
	document.getElementsByTagName('html')[0].setAttribute('id','dark');
}
else{
	document.getElementsByTagName('html')[0].setAttribute('id','light');
}

let i10n = localStorage.getItem('i10n') != null ? localStorage.getItem('i10n') : 'en';
if(localStorage.getItem('i10n') == null){
	localStorage.setItem('i10n',i10n);
}

let ifs = require('fs');

const i10n_csv = ifs.readFileSync(nw.__dirname+'/js/i10n_test.csv','utf8');

let i10nData = {};
i10n_csv.split('\n').slice(1).map(line=>{
	let cells = line.split(',');
	i10nData[cells[0]] = {
		en:cells[1].replace(/"/gi,""),
		cn:cells[2].replace(/"/gi,"")
	};
	
})
localStorage.setItem('i10nData',JSON.stringify(i10nData));
