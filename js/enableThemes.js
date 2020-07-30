console.log('do themes???');
let isDarkMode = localStorage.getItem('isDarkMode') == 'true' ? true : false;
if(isDarkMode){
	document.getElementsByTagName('html')[0].setAttribute('id','dark');
}
else{
	document.getElementsByTagName('html')[0].setAttribute('id','light');
}