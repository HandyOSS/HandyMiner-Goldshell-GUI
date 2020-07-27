let FE;
const fs = require('fs');
const spawn = require('child_process').spawn;
var os = require('os');

const http = require('http');

delete process.env.OPENSSL_CONF;

$(document).ready(function(){
	FE = new feApp();
});
class feApp{
	constructor(){
		/*
		note: leaving a lot of the docker cruft for integration with handybrowser later
		*/
		let appDirPath = process.env.HOME+'/Library/Application\ Support/HandyMiner/';
		if(process.platform == 'win32'){
			appDirPath = process.env.HOMEDRIVE+process.env.HOMEPATH+'/AppData/Local/HandyMiner/User\ Data/Default/';
		}
		if(process.platform == 'linux'){
			appDirPath = process.env.HOME+'/.config/HandyMiner/Default/';
		}
		this.appDirPath = appDirPath;
		/*nw.App.setProxyConfig('127.0.0.1:5301');
		nw.Window.open('./tray.html',{
			width:screen.width,
			height:screen.height,
			frame:false,
			resizable:false
		});*/
		//setTimeout(()=>{
		this.blocksSolvedLast24 = 0;
		this.allTimeBlocks = 0;
		let alltime = 0;
		try{
			alltime = fs.readFileSync(this.appDirPath+'HandyMinerConfigs/allTimeBlocks.json','utf8');
			let j = JSON.parse(alltime);
			alltime = parseFloat(j.count);
		}
		catch(e){
			alltime = 0;
		}
		if(isNaN(alltime)){
			alltime = 0;
		}
		this.allTimeBlocks = alltime;
		let formatSmallSession = this.blocksSolvedLast24 > 1000 ? '0.0a' : '0a';
		let formatSmallAllTime = this.allTimeBlocks > 1000 ? '0.0a' : '0a';
		$('.blocksToday .number').html(numeral(this.blocksSolvedLast24).format(formatSmallSession).toUpperCase())
		$('.blocksAllTime .number').html(numeral(this.allTimeBlocks).format(formatSmallAllTime).toUpperCase());
		this.showMiningConsole();
		//},4000)
		this.resizeStatsPanel();
		nw.Window.get().on('resize',()=>{
			this.resizeStatsPanel();
			this.renderHashrate();
		})
	}
	resizeStatsPanel(){
		let offset = Math.floor($('.stats').offset().top);
		$('.stats').css('height','calc(100% - '+offset+'px)');
	}
	showMiningConsole(){
		//nw.Window.get().focus();
		if(typeof process.env.HOME == "undefined"){
			if(typeof process.env.HOMEDRIVE && process.env.HOMEPATH){
				process.env.HOME = process.env.HOMEDRIVE+process.env.HOMEPATH;
			}
		}

		/**********UPDATE ME PLS*****/
		/*this.network = 'testnet';
		this.prodPort = '13037';
		this.peersPort = '13038';*/
		/*this.network = 'simnet';
		this.prodPort = '15037';
		this.peersPort = '15038';*/
		this.network = 'main';
		this.prodPort = '12937';
		this.peersPort = '12938';
		/*****EXTRA UPDATE ME PLS*******/


		if(typeof process.env.HANDY_IS_MAINNET != "undefined"){
			this.network = 'main';
			this.prodPort = '12937';
			this.peersPort = '12938';
		}

		/*
		this.prodWallet = 'hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8'; //placeholder/defaults
		*/
		this.macUseDocker = true; //tell mac users to start docker machines and whatnot..
		/***********PRETTY PLS ******/
		
		
		process.env.PATH += ':/usr/local/bin';
		process.env.HANDYRAW = true;
		this.isFirstRunEver = false; //is this the first time we ran this?
		this.hashRates = {};
		this.difficulty = {};
		this.asicNames = {};
		this.minerLogs = '';
		this.hsdLogs = '######################################\r\n';
		this.hsdLogs +='############# HANDY MINER ############\r\n';
		this.hsdLogs +='######################################\r\n';
		this.logsVisible = false;
		this.miningMode = 'pool';//solo|pool
		this.soloStratumOption = 'local'; //local || remote
		this.awaitingConfirmation = false;
		this.hsdURL = '127.0.0.1:'+this.prodPort;
		this.hsdUser = 'earthlab';
		/*
		this.hsdWallet = 'hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8'; //placeholder/defaults
		*/
		this.defaultWallet = this.hsdWallet;
		this.hsdWalletPlaceHolder = this.hsdWallet;
		this.last100Blocks = {};
		this.canFetchNetworkTimeline = false;
			
		console.log('fe app is constructed');
		this.initEvents();
		//let config = fs.readFileSync('./HandyMiner/config.json','utf8');
		let config;
		if(!fs.existsSync(this.appDirPath+'HandyMinerConfigs')){
			fs.mkdirSync(this.appDirPath+'HandyMinerConfigs/');
			this.isFirstRunEver = true;
			console.log('created ~/.HandyMiner dir');
			$('#stratum.minerForm .saveButton').html('Save Stratum Details and Build Docker Node')
			//is new-ish
		}
		if(!fs.existsSync(this.appDirPath+'HandyMinerConfigs/config.json')){
			config = {
				"asics":"-1",
				"mode":"",
				"host":"",
				"port":"",
				"stratum_user":"",
				"stratum_pass":"",
				"poolDifficulty":"-1",
				"muteFanfareSong":true,
				"network":this.network
			}
			$('.minerForm#poolUI').removeClass('hidden');
		}
		else{
			config = JSON.parse(fs.readFileSync(this.appDirPath+'HandyMinerConfigs/config.json','utf8'))
			//$('#gpuList').val(config.asics);
			//$('#gpuMfg option').removeAttr('selected');
			//$('#gpuMfg option[value="'+config.gpu_mfg.toLowerCase()+'"]').attr('selected','selected');
			$('#stratumHost').val(config.host);
			$('#stratumPort').val(config.port);
			$('#stratumHostPool').val(config.host);
			$('#stratumPortPool').val(config.port);
			$('#poolProvider option').removeAttr('selected');
			$('#poolProvider option[value="'+config.host+'"]').attr('selected','selected');
			let vals = []
			$('#poolProvider option').each(function(){
				vals.push($(this).val())
			})
			if(vals.indexOf(config.host) == -1){
				$('#poolProvider option[value="other"]').attr('selected','selected');
				$('.advancedStratumSetting').removeClass('hidden');
			}
			$('#stratumUserPool').val(config.stratum_user);
			$('#stratumPassPool').val(config.stratum_pass);
			$('#stratumUser').val(config.stratum_user);
			$('#stratumPass').val(config.stratum_pass);
			$('#network option[value="'+config.network+'"]').attr('selected','selected');
			$('#gpuPlatform option').removeAttr('selected');
			//$('#gpuPlatform option[value="'+config.gpu_platform+'"]').attr('selected','selected');
			//$('#intensity option[value="'+config.intensity+'"]').attr('selected','selected');
			/*if(config.poolDifficulty){
				$('#minerDifficulty').val(config.poolDifficulty);
			}*/
			if(config.muteFanfareSong){
				$('#muteFanfare').attr('checked','checked');
			}
			/*config.gpus.split(',').map(function(item){
				let $tmpl = $('#gpuTemplate').clone();
				$tmpl.removeAttr('id');
				$tmpl.attr('data-id',item);
				$tmpl.addClass('gpuIcon')
				$('li',$tmpl).eq(0).html('GPU'+item);
				$('li',$tmpl).eq(1).html('0MH');
				$('.gpuStatus').append($tmpl);
			})*/
			this.miningMode = config.mode || 'pool'
		}
		this.config = config;
		
		if(this.config.mode == 'pool'){
			$('.blocksAllTime .label').html('Shares All Time');
			$('.blocksToday .label').html('Session Shares')
		}

		console.log('home loc??',process.env.HOME);
		this.initLogo();
		setTimeout(()=>{
			/*fs.readFile(this.appDirPath+'HandyMinerConfigs/hsdConfig.json',(err,d)=>{
				if(!err){
					console.log('done reading configs?')
					this.hsdConfig = JSON.parse(d.toString('utf8'));
					$('#hsdApiPass').val(this.hsdConfig.apiKey);
					$('#hsdMinerWallet').val(this.hsdConfig.wallet);
					this.hsdWallet = this.hsdConfig.wallet;
					if(typeof this.hsdConfig.url != "undefined"){
						$('#hsdAPIUrl').val(this.hsdConfig.url);
						$('#hsdAPIPass').val(this.hsdConfig.apiKey);
						this.hsdURL = this.hsdConfig.url;
					}
					console.log('should launch hsd then?')
					
					this.launchHSD();
					console.log('auto launched HSD on start')
					//fs.writeFileSync(process.env.HOME+'/.HandyMiner/hsdConfig.json',JSON.stringify(this.hsdConfig))
				}
				else{
					//no config was found, first timer i guess
					//this.initLogo();
					this.hideLoading();
					console.log('err launching hsd?',d.toString('utf8'))
				}
			});*/
			this.hideLoading();
		},3000);
		console.log('config isset??',config);
		/*this.getHSDNetworkInfo();
		this.startTimer();*/
	}
	initEvents(){
		const _this = this;
		$('.nukeDocker').off('click').on('click',function(){
			if(!$(this).hasClass('doRemoveThisTime')){
				$('.nukeDocker').addClass('doRemoveThisTime');
				$('.nukeDocker').html('Click again to confirm nuke. It will take 2-5 mins to reconstruct FYI.')
			}
			else{
				//we actually nuke then.
				_this.nukeDockerContainer();
				$('.nukeDocker').removeClass('doRemoveThisTime');
				$('.nukeDocker').html('DONE! Docker will rebuild now.')
				setTimeout(function(){
					$('.minerForm:not(#main)').addClass('hidden');
					$('#logs').removeClass('hidden').removeClass('required');
					_this.logsVisible = true;
					_this.pushToLogs('####DOCKER:: NUKING DOCKER CONTAINER...','stdout','hsd')
				},1000)
				setTimeout(function(){
					$('.nukeDocker').html('Nuke and Rebuild Docker Machine')
				},5000)
				
			}

		})
		$('#poolProvider').off('change').on('change',()=>{
			let val = $('#poolProvider option:selected').val();
			$('#stratumHostPool').val(val);
			//set ports automagically
			switch(val){
				case 'hns.f2pool.com':
					$('#stratumPortPool').val('6000');
					hidePass();
				break;
				case 'stratum+tcp://handshake.6block.com':
					$('#stratumPortPool').val('7701');
					hidePass();
				break;
				case 'hns-us.ss.poolflare.com':
					$('#stratumPortPool').val('3355');
					hidePass();
				break;
				case 'stratum-us.hnspool.com':
					$('#stratumPortPool').val('3001');
					$('#stratumUserPool').attr('placeholder','Account Username');
					$('#stratumPassPool').attr('placeholder','Account Password');
					$('#poolPass').removeClass('hidden');
					$('#stratumUserPool').removeClass('superwide');
				break;
				case 'hns.ss.dxpool.com':
					$('#stratumPortPool').val('3008');
					$('#stratumUserPool').attr('placeholder','Account Username.WorkerName');
					
				break;
				case 'other':
					$('#stratumPortPool').val('').attr('placeholder','Port');
					$('#stratumHostPool').val('').attr('placeholder','127.0.0.1 or hns.somepool.com');
					$('.advancedStratumSetting').removeClass('hidden');
				break;
			}
			function hidePass(){
				$('#stratumUserPool').attr('placeholder','wallet.rigName');
				$('#stratumPassPool').attr('placeholder','Anything');
				$('#poolPass').addClass('hidden');
				$('#stratumUserPool').addClass('superwide');
			}
		})
		let _useStratumAdvancedSettings = false;
		$('#advancedPoolSettings').off('click').on('click',()=>{
			$('.stratumSubElement.advancedStratumSetting').toggleClass('hidden');
		});
		$('.saveButton').off('click').on('click',function(){
			let host,port,stratumUser,stratumPass,hsdApiKey,hsdMinerWallet;
			switch($(this).parents('.minerForm').attr('id')){
				case 'gpus':
					console.log('save gpus info');
					let mfg = $('#gpuMfg option:selected').val();
					let platformID = $('#gpuPlatform option:selected').val();
					let gpus = $('#gpuList').val();
					let intensity = $('#intensity option:selected').val();
					let muteFanfare = $('#muteFanfare').is(':checked');
					console.log('gpus isset',gpus);
					_this.config.gpu_mfg = mfg;
					_this.config.gpus = gpus;
					_this.config.gpu_platform = platformID;
					_this.config.intensity = intensity;
					_this.config.muteFanfareSong = muteFanfare;
					/*
					let $tmpl = $('#gpuTemplate').clone();
					$tmpl.removeAttr('id');
					let t = $tmpl.clone();
					t.attr('data-id',v);
					t.addClass('gpuIcon');
					$('li',t).eq(0).html('GPU'+v);
					$('li',t).eq(1).html('0MH');
					$('.gpuStatus').append(t);
					*/
					let $tmpl = $('#gpuTemplate').clone();
					$tmpl.removeAttr('id');
					let gpuArr = gpus.split(',');
					$('.gpuStatus .gpuIcon').remove();
					gpuArr.map(function(gpuID){
						let t = $tmpl.clone();
						t.attr('data-id',gpuID);
						t.addClass('gpuIcon');
						$('li',t).eq(0).html('GPU'+gpuID);
						$('li',t).eq(1).html('--GH');
						$('.gpuStatus').append(t);
					})
					fs.writeFileSync(this.appDirPath+'HandyMinerConfigs/config.json',JSON.stringify(_this.config,null,2));
					console.log('mfg',mfg,'plat',platformID,'gpus',gpus);
				break;

				case 'stratum':
					//console.log('save stratum info')
					console.log('save stratum info solo strat and mining mode',_this.soloStratumOption,_this.miningMode);
					console.log('yaaaaaaaaaaaaaaaaa')
					//check miningmode here
					//this.soloStratumOption
					if(_this.soloStratumOption == 'local' && _this.miningMode == 'solo'){
						host = '127.0.0.1';
						port = '3008';
						stratumUser = 'earthlab';
						stratumPass = 'earthlab';
					}
					else{
						host = $('#stratumHost').val() || '127.0.0.1';
						port = $('#stratumPort').val() || '3008';
						stratumUser = $('#stratumUser').val() || 'earthlab';
						stratumPass = $('#stratumPass').val() || 'earthlab';	
					}
					_this.config.network = $('#network option:selected').val() || 'testnet';

					let portO;
					let portP;
					let midChar = '0';
					if(host == '127.0.0.1' || host.indexOf('192.168') >= 0){
						midChar = '9';
					}
					switch(_this.config.network){
						case 'main':
							portO = '12'+midChar+'37';
							portP = '12'+midChar+'38';
						break;
						case 'testnet':
							portO = '13'+midChar+'37';
							portP = '13'+midChar+'38';
						break;
						case 'simnet':
							portO = '15'+midChar+'37';
							portP = '15'+midChar+'38';
						break;
						case 'regtest':
							portO = '14'+midChar+'37';
							portP = '14'+midChar+'38';
						break;
					}

					_this.peersPort = portP;
					_this.config.host = host;
					_this.config.port = port;
					_this.config.stratum_user = stratumUser;
					_this.config.stratum_pass = stratumPass;

					_this.hsdUser = _this.config.stratum_user;
					_this.hsdURL = $('#hsdAPIUrl').val() || _this.hsdURL;
					_this.config.hsdURL = _this.hsdURL;
					console.log('hsdrul???',_this.hsdURL);
					let parts = _this.hsdURL.split(':');
					console.log('parts',parts);
					let pbase = parts.slice(0,-1);
					if(pbase.length == 0){
						pbase = ['127.0.0.1'];
					}
					pbase = pbase.concat(portO).join(':')
					_this.hsdURL = pbase;

					hsdApiKey = $('#hsdAPIPass').val() || $('#stratumPass').val() || 'earthlab';
					if(_this.soloStratumOption == 'local' && _this.miningMode == 'solo'){
						hsdApiKey = 'earthlab';
					}
					hsdMinerWallet = '';//$('#hsdMinerWallet').val().trim() || 'hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8';
					_this.hsdWallet = hsdMinerWallet;
					if(typeof hsdApiKey != "undefined" && typeof hsdMinerWallet != "undefined"){
						_this.hsdConfig = {wallet:hsdMinerWallet,apiKey:hsdApiKey,url:_this.hsdURL};
						fs.writeFileSync(this.appDirPath+'HandyMinerConfigs/hsdConfig.json',JSON.stringify(_this.hsdConfig))
					}
					console.log('we want to restart docker now',_this.macUseDocker);
					if(_this.macUseDocker || process.platform.toLowerCase().indexOf('win') == 0){
						console.log('should now restart docker container')
						_this.restartDockerContainer(true)
					}
					else{
						_this.launchHSD(true);
					}
					
					$('.nukeDocker').removeClass('doRemoveThisTime');
					$('.nukeDocker').html('Nuke and Rebuild Docker Machine')
				
					console.log('vals',host,port,stratumUser,stratumPass);
				break;

				case 'poolUI':
					console.log('save stratum info')
					host = $('#stratumHostPool').val() || '127.0.0.1';
					port = $('#stratumPortPool').val() || '3008';
					stratumUser = $('#stratumUserPool').val() || 'earthlab';
					stratumPass = $('#stratumPassPool').val() || 'earthlab';
					_this.config.host = host;
					_this.config.port = port;
					_this.config.stratum_user = stratumUser;
					_this.config.stratum_pass = stratumPass;
					_this.hsdUser = _this.config.stratum_user;
					_this.hsdURL = $('#hsdAPIUrlPool').val() || _this.hsdURL;
					_this.config.hsdURL = _this.hsdURL;

					hsdApiKey = $('#hsdAPIPassPool').val() || $('#stratumPassPool').val() || 'earthlab';
					hsdMinerWallet = '';
					//_this.hsdWallet = hsdMinerWallet;
					let poolDifficulty = '-1';//$('#minerDifficulty').val() || '-1';
					_this.config.poolDifficulty = poolDifficulty;
					if(typeof hsdApiKey != "undefined" && typeof hsdMinerWallet != "undefined"){
						_this.hsdConfig = {wallet:hsdMinerWallet,apiKey:hsdApiKey,url:_this.hsdURL};
						fs.writeFileSync(_this.appDirPath+'HandyMinerConfigs/hsdConfig.json',JSON.stringify(_this.hsdConfig))
					}

					fs.writeFileSync(_this.appDirPath+'HandyMinerConfigs/config.json',JSON.stringify(_this.config,null,2));
					_this.launchHSD();
					console.log('vals',host,port,stratumUser,stratumPass);
				break;
				default:

				break;
			}

			$(this).parents('.minerForm').addClass('hidden');
		});
		$('.queryGPUs').off('click').on('click',function(){
			_this.queryGPUs();
		})
		/*$('.settings').off('click').on('click',function(){
			$('.minerForm').removeClass('hidden');
		});*/
		$('.settings').off('mouseenter').on('mouseenter',function(){
			$('#settingsOptions').show();
			$(this).addClass('hovered');
		});
		if(process.platform.toLowerCase().indexOf('darwin') >= 0){
			$('.logs').addClass('mac');
		}
		$('.startStop, .logs').off('mouseenter').on('mouseenter',function(){
			$('#settingsOptions').hide();
			$('.settings').removeClass('hovered');
		});
		$('#settingsOptions').off('mouseleave').on('mouseleave',function(){
			$('#settingsOptions').hide();
			$('.settings').removeClass('hovered');
		});
		$('#settingsOptions li').off('click').on('click',function(){
			var id = $(this).attr('id');
			_this.hideLoading();
			switch(id){
				case 'miningMode':
				default:
					$('#poolUI').removeClass('hidden');
				break;
				case 'gpuSettings':
					$('.minerForm#gpus').removeClass('hidden');
				break;
			}
		})
		$('.logs').off('click').on('click',function(){
			_this.logsVisible = true;
			_this.hideLoading();
			$('.logs').removeClass('alerted');
			//$('#logs pre#logOutput').html(_this.hsdLogs);
			//$('#logs pre#logOutput')[0].scrollTop = $('#logs pre#logOutput')[0].scrollHeight;
			$('#logs').removeClass('hidden').removeClass('required');
		})
		$('.startStop').off('click').on('click',function(){
			if($(this).hasClass('paused')){
				//should play
				$(this).html('&#9612;&#9612;');
				$(this).addClass('playing');
				$(this).attr('title','pause miner');
				$(this).removeClass('paused');
				$('.gpuStatus .gpuIcon').remove();
				_this.startMiner();
				
			}
			else{
				$(this).html('&#9654;')
				$(this).addClass('paused');
				$(this).attr('title','start miner');
				$(this).removeClass('playing');
				_this.stopMiner();
			}
		})
		this.startTimer();
		nw.Window.get().on('close',function(){
			if(typeof _this.hsdProcess != "undefined"){
				_this.hsdProcess.kill();
			}
			if(typeof _this.minerProcess != "undefined"){
				try{
	  				_this.minerProcess.stdin.write('dashboard sigint');
		  		}
		  		catch(e){

		  		}
			}
			if(process.platform.toLowerCase().indexOf('win') == 0 || _this.macUseDocker){

				_this.stopDockerMachine();
			}
			this.close(true);
		});

		$('#cyoa .option').off('click').on('click',function(){
			let v = $(this).attr('id');
			_this.miningMode = v;
			_this.config.mode = v;
			$('#cyoa').addClass('hidden');
			switch(v){
				case 'solo':
					//$('#poolUI').addClass('hidden')
					testHSD('solo');
				break;
				case 'pool':
					testHSD('pool');
					$('#cyoa2').addClass('hidden');
					$('#stratum').addClass('hidden');
				break;
				default:

				break;
			}
		});
		function testHSD(mode){
			let apiKey = 'earthlab';
			apiKey = _this.hsdConfig ? _this.hsdConfig.apiKey : apiKey;
			$.post('http://x:'+apiKey+'@'+_this.hsdURL,JSON.stringify({params:[],method:'getmininginfo'}),function(d){
				console.log('got mining info?',d);
				if(d == '[]' || d == [] || d == ''){
					//empty, means were still not in yet
					$('#hsdAPI .notes').show();
				}
				else{
					//TODO show their IP to them? not needed yet..
				}
				
				//success, we can just leave things hidden
			}).fail(function(){
				let selector;
				/*switch(mode){
					case 'pool':
						selector = '#poolUI';
					break;
					case 'solo':
						selector = '#stratum';
					break;
					default:
						selector = '#stratum';
					break;
				}*/
				$('#hsdAPI .notes').hide();
				//try using solo server then..

			})
		}
		$('#cyoa2 .option').off('click').on('click',function(){
			let v = $(this).attr('id');
			$('#cyoa2').addClass('hidden');
			$('#poolUI').addClass('hidden');
			$('#stratum').removeClass('hidden');
			switch(v){
				case 'local':
					//hide all the form elems
					_this.soloStratumOption = 'local';
					$('#stratum #hsdAPI').hide();
					$('#stratum #userPass').hide();
					$('#stratum #serverPort').hide();

				break;
				case 'remote':
					_this.soloStratumOption = 'remote';
					//show all the form elems
					//$('#stratum #hsdAPI').show();
					$('#stratum #userPass').show();
					$('#stratum #serverPort').show();
				break;
			}
		});
		$('#logs .close').off('click').on('click',function(){
			$('#logs').addClass('hidden');
			_this.logsVisible = false;
		})
		console.log('init evts??');
		$(window).on('keyup',function(e){
			console.log('e',e.key,e.key == 'Escape');
			if(e.key == 'Escape'){
				$('.minerForm:not(#main)').addClass('hidden');
				$('#logs').addClass('hidden');
			}
		})
	}
	launchHSD(isFirstTimeLaunch){
		return false;
		//deprecating from goldshell so we dont have to depend on docker/hsd for pool mining
		const _this = this;
		let walletTarget = this.prodWallet;
		if(typeof this.hsdConfig.wallet != "undefined"){
			if(this.hsdConfig.wallet != this.hsdWalletPlaceHolder){
				walletTarget = this.hsdConfig.wallet;
			}
		}
		this.hsdParams = [
			'--network='+(this.config.network || 'main'),
			'--cors=true', 
			'--api-key='+this.hsdConfig.apiKey,
			'--http-host=0.0.0.0',
			'--coinbase-address='+walletTarget,
			'--index-address=true',
			'--index-tx=true',
			'--listen',
			'--plugins',
			'hstratum',
			'--stratum-host',
			'0.0.0.0',
			'--stratum-port',
			this.config.port,
			'--stratum-public-host',
			'0.0.0.0',
			'--stratum-public-port',
			this.config.port,
			'--stratum-max-inbound',
			'1000',
			'--stratum-difficulty',
			'8',
			'--stratum-dynamic',
			'--stratum-password='+this.config.stratum_pass
		];
		if(typeof this.hsdProcess != "undefined"){
			this.killHSD();
			this.hideLoading();
		};
		let apiKey = this.hsdConfig.apiKey;
		let wallet = this.hsdConfig.wallet;
		if(wallet == ''){
			wallet = this.prodWallet;
		}
		

		if(process.platform.toLowerCase().indexOf('win') == 0 || _this.macUseDocker){

			_this.checkDockerSupport(isFirstTimeLaunch);
			//if it's windows we'll launch HSD in docker, yas
		}
		if(isFirstTimeLaunch){
			this.hideLoading();
			$('#logs').addClass('required').removeClass('hidden');
			$('#logs pre#logOutput').html('Initializing HSD Installation...\r\n');
			$('#logs pre#logOutput').append('#################################\r\n');
			setTimeout(function(){
				$('#logs').removeClass('required');
			},5000)
		}
		//}

		if(!_this.macUseDocker){
			//launch hsd locally then
			let hsdParams = this.hsdParams;
			console.log('hsd params isset',process.env);

			
			if(!envParams.env.NODE_BACKEND){
				envParams.env.NODE_BACKEND = 'native';
			}
			else{
				console.log("HEYYYYYYYYYY NODE BACKEND WAS HERE",envParams.env.NODE_BACKEND);
			}
			let executable = process.platform.toLowerCase().indexOf('darwin') == 0 ? process.execPath : nw.global.__dirname+'/externals/node.exe';
			
			let hsdProcess = spawn(executable,newParams,envParams)
			let hsdLogs = '';

			console.log('should cwd to ',nw.__dirname+'/submodules/HandyMiner-CLI/node_modules/hsd')
			this.hsdProcess = hsdProcess;
			
			this.hsdProcess.stderr.on('data',function(d){
				console.log('sdterr',d.toString('utf8'));
				//console.log('hsd stderr',d.toString('utf8'))
				if(this.isFirstTimeLaunch){
					$('#logOutput').append(d.toString('utf8'));
					$('#logs pre#logOutput')[0].scrollTop = $('#logs pre#logOutput')[0].scrollHeight;
					$('#logs').removeClass('required');
				}
				else{
					
					_this.pushToLogs(d.toString('utf8'),'error','hsd')
				}
				_this.hideLoading();
			});
			this.hasLogged = false;
			this.hsdProcess.stdout.on('data',(d)=>{
				//console.log('data??',d.toString('utf8'));
				return false;
				//deprecating for now
				if(!this.hasLogged){
					this.hsdIsRunningLocally = true;
					this.hasLogged = true;
					this.hideLoading();
					setTimeout(function(){
						_this.addPeers();
					},1000);
				}
				//console.log('hsd stdout',d.toString('utf8'));
				hsdLogs += d.toString('utf8')+'\r\n';
				if(hsdLogs.length >= 1000000){
					hsdLogs = hsdLogs.slice(-10000);
				}
				if(isFirstTimeLaunch){
					$('#logOutput').html(hsdLogs);
					$('#logs pre#logOutput')[0].scrollTop = $('#logs pre#logOutput')[0].scrollHeight;

				}
				else{
					console.log("HEYYYYYYYYYY NODE BACKEND WAS HERE",envParams.env.NODE_BACKEND);
				}

			});
			this.hsdProcess.on('close',function(d){
				//console.log('ps closed!?',d.toString('utf8'))
				this.hsdIsRunningLocally = false;
				/*$('.syncedIcon').addClass('alert');
				$('.syncedButton .statusLabel').html('Local HSD Closed');*/
			})

			console.log('run test start');


		/*let t = spawn('which',['node'],{env:process.env})
		t.stdout.on('data',function(d){
			console.log('test stdout',d.toString('utf8'))
		});
		t.stderr.on('data',function(d){
			console.log('test stderr',d.toString('utf8'))
		});
		t.on('close',function(d){
			console.log('test is closed');
		})*/
		//if(process.platform.toLowerCase().indexOf('darwin') >= 0){
			
		}
		//}
		//_this.initLogo();
		//setTimeout(function(){
			_this.getHSDNetworkInfo();
			//_this.startTimer();
		//},3000)
	}
	killHSD(){
		this.hsdProcess.kill();
	}
	addPeers(){
		return false; //deprecating
		//manually add some peers
		let peersPort = this.peersPort || '13038';
		let hsdPort = '13037';
		if(['testnet','simnet'].indexOf(this.config.network) == -1){
			return;
		}
		

		switch(this.config.network){
			case 'main':
				hsdPort = '12037';
				peersPort = '12038';
			break;
			case 'testnet':
				hsdPort = '13037';
				peersPort = '13038';
			break;
			case 'simnet':
				hsdPort = '15037';
				peersPort = '15038';
				
			break;
		}
		let nodeaddr = 'aorsxa4ylaacshipyjkfbvzfkh3jhh4yowtoqdt64nzemqtiw2whk@3.14.224.108:'+peersPort;
		$.ajax('http://x:'+this.hsdConfig.apiKey+'@127.0.0.1:'+(hsdPort.replace('0','9'))+'/',{
			type:'POST',
			contentType:'application/json',
			data:JSON.stringify({method:'addnode',params:[nodeaddr,'add']})
		})
		//$.post('http://x:'+this.hsdConfig.apiKey+'@127.0.0.1:13037/',{method:'addnode',params:[nodeaddr,'add']});
	}
	getGlobalIP(callback){
		var options = {
		  host: 'ipv4bot.whatismyipaddress.com',
		  port: 80,
		  path: '/'
		};
		let extIP = '';
		let intIP = '127.0.0.1';

		var ifaces = os.networkInterfaces();
		let desired = ['Ethernet','Wi-Fi','en0'];
		Object.keys(ifaces).forEach(function (ifname) {
		  var alias = 0;

		  ifaces[ifname].forEach(function (iface) {
		    if ('IPv4' !== iface.family || iface.internal !== false) {
		      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
		      return;
		    }

		    if (alias >= 1) {
		      // this single interface has multiple ipv4 addresses
		      console.log(ifname + ':' + alias, iface.address);
		      
		    } else {
		      // this interface has only one ipv4 adress
		      
		      console.log(ifname, iface.address);
		    }
		    if(desired.indexOf(ifname) >= 0){
	      		intIP = iface.address;
	      	}
		    ++alias;
		  });
		});
		http.get(options, function(res) {
		  console.log("status: " + res.statusCode);

		  res.on("data", function(chunk) {
		  	extIP = chunk.toString('utf8');
		  	callback(null,{external:extIP,internal:intIP});
		    console.log("BODY: " + chunk);
		  });
		}).on('error', function(e) {
			callback(e,e.message);
		  console.log("error: " + e.message);
		});
	}
	queryGPUs(){
		//testdata
		this.showLoading();
		$('.modalContent').html('<ul />');
		console.log('query gpus?',nw.__dirname+'/submodules/HandyMiner-CLI');
		process.env.HANDYRAW = 'true';
		let executable = process.platform.toLowerCase().indexOf('darwin') == 0 ? process.execPath : nw.global.__dirname+'/externals/node.exe';
		process.env.HANDYMINER_GUI_NODE_EXEC = executable;

		let queryProcess = spawn(executable,
			['./mine.js','-1',$('#gpuPlatform option:selected').val() || '0','amd'	],
			{
				cwd:nw.__dirname+'/submodules/HandyMiner-CLI/',
				env:process.env
			});
		console.log('qp isset???',queryProcess);
		queryProcess.stderr.on('data',function(d){
			console.log('data err',d);
			//$('.gpuPlatformNote').html('No GPUs found, try another platform').addClass('err');
		})
		let hasFoundGPUs = false;
		queryProcess.stdout.on('data',(d)=>{
			console.log('data returned',d.toString('utf8'));
			let dN = d.toString('utf8').split('\n');
			
			dN.map((line)=>{
				try{
					let json = JSON.parse(line.toString('utf8'));
					console.log('data back',json);
					if(json.type == 'registration'){
						//do something with numdevices
						console.log('will show devices now');
						hasFoundGPUs = true;
						showDevices(json.data);
						$('.gpuPlatformNote').html(' ').removeClass('err');
						this.pushToLogs(JSON.stringify(json),'stdout','miner');
						setTimeout(()=>{
							queryProcess.kill();
						},5000)
					}
					if(json.type == 'error'){
						if(json.message != 'not up to date'){
							if(!hasFoundGPUs){
								$('.gpuPlatformNote').html('No GPUs found, try another platform').addClass('err');
							}
							this.hideLoading();
						}
						this.pushToLogs(JSON.stringify(json),'error','miner');
					}
				}
				catch(e){

				}
			})
			
		})
		queryProcess.stderr.on('data',(d)=>{
			console.log('error????',d.toString('utf8'))
			//$('.gpuPlatformNote').html('No GPUs found, try another platform').addClass('err');
			this.hideLoading();
			this.pushToLogs(d.toString('utf8'),'error','miner');
			$ul.html('There was an error.. Check the logs (top right icon) for more details.')
		})
		queryProcess.on('close',()=>{
			//done
			console.log('spawn finished, yay');
			setTimeout(()=>{
				this.hideLoading();
			},3000)
			
		});
		function showDevices(data){
			let $tmpl = $('#gpuTemplate').clone();
			$tmpl.removeAttr('id');
			let $ul = $('.modalContent ul');//$('<ul></ul>');
			data.map(function(d){
				/*
				<div class="checkbox-container">
		        <label class="checkbox-label">
		            <input type="checkbox" id="muteFanfare" value="1" />
		            <span class="checkbox-custom rectangular"></span>
		        </label>
		        <label id="fflabel" for="muteFanfare">Mute Fanfare Winning Song</label>
		    </div>
				*/
				let cbWrap = $('<div class="checkbox-container"></div>')
				let $label = $('<label class="checkbox-label"></label>')
				$label.append('<input type="checkbox" id="gpu'+d.id+'" value="'+d.id+'" class="checks" />')
				$label.append('<span class="checkbox-custom rectangular"></span>');
				cbWrap.append($label);
				let gpuStringName = d.name;
				if(d.name.toLowerCase().indexOf('gfx900') >= 0){
					gpuStringName = 'AMD Vega Series';					
				}
				if(d.name.toLowerCase().indexOf('ellesmere') >= 0){
					gpuStringName = 'AMD RX**0 Series';
				}
				let $tLabel = $('<label class="tLabel" for="gpu'+d.id+'">GPU'+d.id+': '+gpuStringName+'</label>');
				cbWrap.append($tLabel);
				console.log('gpu name?',d.name,d.name.toLowerCase().indexOf('intel'))
				
				//$ul.append('<li><input type="checkbox" value="'+d.id+'" class="checks" /> GPU'+d.id+': '+d.name+'</li>')
				let $li = $('<li />')
				$li.append(cbWrap);
				$ul.append($li);
				if(d.name.toLowerCase().indexOf('intel') >= 0 && d.name.toLowerCase().indexOf('hd graphics') >= 0){
					$tLabel.addClass('isIntel')
					$li.append('<small class="isIntel">Note: Using this GPU Will Impact Computer Performance</small>')
				}
			});
			//$('.modalContent').html($ul);

			$('#modal .save').off('click').on('click',function(){
				let outStr = [];
				$('input:checked',$ul).each(function(){
					var v = $(this).val();
					let t = $tmpl.clone();
					t.attr('data-id',v);
					t.addClass('gpuIcon');
					$('li',t).eq(0).html('GPU'+v);
					$('li',t).eq(1).html('--GH');
					$('.gpuStatus').append(t)
					outStr.push(v);
				});
				$('#gpuList').val(outStr.join(','));

				$('#modal').hide();
			})
			$('#modal .close').off('click').on('click',function(){
				$('#modal').hide();
			})
			$('#modal').show();
		}
		/*let data = [ 
			{ event: 'registerDevice',
		    id: '0',
		    name: 'Intel(R) HD Graphics 630',
		    platform: '0' },
		  { event: 'registerDevice',
		    id: '1',
		    name: 'AMD Radeon Pro 560 Compute Engine',
		    platform: '0' 
		  } 
		];*/
		
	}
	getHSDNetworkInfo(isAttempt2){
		return false; //deprecating for goldshell gui
		const _this = this;
		let info = {};
		let qL = 4;
		let qC = 0;
		let hasFired = false;
		$.post('http://x:'+this.hsdConfig.apiKey+'@'+this.hsdURL,JSON.stringify({params:[],method:'getmininginfo'}),function(d){
			console.log('got mining info?',d);
			info['mining'] = d.result;
			_this.pushToLogs('MINING INFO::  '+JSON.stringify(d.result)+'\r\n','stdout','hsd')
			qC++;
			if(qC == qL && !hasFired){
				hasFired = true;
				done();
			}
		}).fail(function(){
			console.log('something failed????')
			

			//try stratum host if solo mode then
			_this.hideLoading();
			console.log('and modes info',_this.miningMode,_this.config.host+':'+_this.config.port,_this.hsdURL);
			if(_this.miningMode == 'solo' && _this.config.host+':'+_this.config.port != _this.hsdURL && _this.config.host != ""){
				_this.hsdConfig.url = _this.config.host+':'+_this.hsdURL.split(':')[1];
				_this.hsdConfig.apiKey = _this.config.stratum_pass;
				_this.hsdURL = _this.hsdConfig.url;
				console.log('set garbage params',_this.hsdURL);
				$('.statusPrefix').html('Remote Node ');
				if(!isAttempt2){
					_this.getHSDNetworkInfo(true);
				}
				else{
					$('.syncedButton .statusLabel').html('Failed to initialize remote HSD');
					if(_this.macUseDocker && process.platform.indexOf('darwin') >= 0){
						$('.statusPrefix').html('Local Node ')
						$('.syncedButton .statusLabel').html('Trying to Start Local Docker...');
					}
				}
				return;
			}
		})
		let respCount = 0;
		let respTarget = 2;
		$.post('http://x:'+this.hsdConfig.apiKey+'@'+this.hsdURL,JSON.stringify({params:[],method:'getblockchaininfo'}),function(d){
			console.log('got chain info?',d);
			info['chain'] = d.result;
			_this.pushToLogs('CHAIN INFO:: '+JSON.stringify(d.result)+'\r\n','stdout','hsd')
			qC++;
			if(qC == qL && !hasFired){
				hasFired = true;
				respCount++;
				done();
			}
		});
		$.post('http://x:'+this.hsdConfig.apiKey+'@'+this.hsdURL,JSON.stringify({params:[],method:'getnetworkinfo'}),function(d){
			console.log('got mining info?',d);
			info['network'] = d.result;
			_this.pushToLogs('NETWORK INFO:: '+JSON.stringify(d.result)+'\r\n','stdout','hsd')
			qC++;
			if(qC == qL && !hasFired){
				hasFired = true;
				respCount++;
				done();
			}
		});
		
		$.post('http://x:'+this.hsdConfig.apiKey+'@'+this.hsdURL,JSON.stringify({params:[],method:'getpeerinfo'}),function(d){
			console.log('peers are set',d);
			let greatestHeight = 0;
			info['peers'] = d.result;
			d.result.map(peer=>{
				if(peer.startingheight > greatestHeight){
					greatestHeight = peer.startingheight;
				}
			});
			_this.peersGreatestHeight = greatestHeight;
			_this.pushToLogs('PEERS INFO:: '+JSON.stringify(d.result)+'\r\n','stdout','hsd');
			qC++;
			if(qC == qL && !hasFired){
				hasFired = true;
				respCount++;
				done();
			}

		});

		function done(){
			
			console.log('got network info',info);
			_this.hsdInfo = info;

			if(info.mining.blocks == 0 /*&& info.mining.chain == 'test'*/){
				console.log('garbage time');
				//assume this is bogus unsynced garbage and try to sync w solo pool host
				if(isAttempt2){
					$('.syncedIcon').addClass('alert');
					$('.syncedButton .statusLabel').html('Dockerized HSD Started, but Block Height is 0');
					_this.hideLoading();
				}
				if(_this.miningMode == 'solo' && _this.config.host+':'+_this.config.port != _this.hsdURL && _this.config.host != ""){
					_this.hsdConfig.url = _this.config.host+':'+(_this.hsdURL.split(':')[_this.hsdURL.split(':').length-1]);
					_this.hsdConfig.apiKey = _this.config.stratum_pass;
					_this.hsdURL = _this.hsdConfig.url;
					console.log('set garbage params',_this.hsdURL);
					if(!isAttempt2){
						_this.getHSDNetworkInfo(true);
					}
					if(info.peers.length == 0 && (info.chain.chain == 'simnet' || info.chain.chain == 'regtest') && info.chain.blocks == 0){
						//dont return, it's simnet
					}
					else{
						return;
					}
					
				}
			}
			let heightNow = info.mining.blocks;
			if(typeof _this.lastKnownHeight	== "undefined"){
				_this.lastKnownHeight = _this.peersGreatestHeight || 0;
			}
			$('.title a').attr('href','http://hnscan.com/block/'+heightNow).html(heightNow)
			let bI = 0;
			let bC = 100;
			let blocks = {}
			//setTimeout(()=>{
			//if(_this.canFetchNetworkTimeline){
				//},1000)
				if(Math.abs(_this.lastKnownHeight - heightNow) < 5 && Math.abs(heightNow - _this.peersGreatestHeight) < 10){

					console.log("FETCHING SOME TOOOONS OF TX")
					let hnStart = heightNow-100 < 0 ? 0 : heightNow-100;
					if(hnStart == 0){
						bC = _this.lastKnownHeight;
						console.log('last known height is small',bC);
					}
					
					for(let i=hnStart;i<=heightNow;i++){
						$.post('http://x:'+_this.hsdConfig.apiKey+'@'+_this.hsdURL,JSON.stringify({params:[i,true,false],method:'getblockbyheight'}),function(d){
							//console.log('got block info?',d);
							blocks[i] = d.result;
							setTimeout(function(){
								_this.hideLoading();
							},1000)
							let tx = d.result.tx[0];
							$.get('http://x:'+_this.hsdConfig.apiKey+'@'+_this.hsdURL+'/tx/'+tx,function(d){
								blocks[i]._txDetail = d;
								if(d.outputs[0].address == _this.hsdWallet){
									blocks[i].isMyBlock = true;
								}
								bI++;
								if(bI == bC){
									blocksDone(blocks,heightNow);
								}
							});

							
						});
						if(i == 0 && bC == 0){
							blocksDone(blocks,heightNow);
						}
					}
				}
				else{
					console.log('last known height is fuckin huge',_this.lastKnownHeight,heightNow,Math.abs(_this.lastKnownHeight - heightNow))
				}
			//}
			_this.lastKnownHeight = heightNow;
		}
		function blocksDone(blocks,heightNow){
			
			console.log('loaded 100 blocks',blocks);
			_this.hideLoading();
			_this.last100Blocks = blocks;
			let timeMin = new Date().getTime() - (24 * 60 * 60 * 1000);
			let blocksTotal = 0;
			Object.keys(_this.last100Blocks).map((blockKey)=>{
				let blockD = _this.last100Blocks[blockKey];
				if(blockD.time*1000 >= timeMin && blockD.isMyBlock){
					console.log('blocks are mine!');
					blocksTotal++;
				}
			})
			_this.blocksSolvedLast24 = blocksTotal;
			let alltime = 0;
			try{
				alltime = fs.readFileSync(this.appDirPath+'HandyMinerConfigs/allTimeBlocks.txt','utf8');
				alltime = parseFloat(alltime);
			}
			catch(e){
				alltime = 0;
			}
			if(isNaN(alltime)){
				alltime = 0;
			}
			if(parseFloat(_this.blocksSolvedLast24) > parseFloat(alltime)){
				alltime = _this.blocksSolvedLast24;
			}
			console.log('alltime and not',alltime,_this.blocksSolvedLast24)
			_this.allTimeBlocks = alltime;
			$('.blocksToday .number').html(numeral(_this.blocksSolvedLast24).format('0a').toUpperCase())
			$('.blocksAllTime .number').html(numeral(_this.allTimeBlocks).format('0a').toUpperCase());
			_this.canFetchNetworkTimeline = true;
			//_this.getHSDNetworkInfo();
			setTimeout(function(){
				$('.syncedIcon').removeClass('alert').addClass('success');
				$('.syncedButton .statusLabel').html('synced at block: '+heightNow);
				$('.syncedButton').fadeOut(5000);
			},500)
			_this.renderLastBlocks(blocks);
			_this.renderHashrate();
			

		}
	}
	startHashrateChartTicks(){
		console.log('hashrate chart tick init')
		if(typeof this.hashrateDisplayInterval != "undefined"){
			return false;
		}
		setTimeout(()=>{
			this.renderHashrate();
		},1000);
		//this.renderHashrate();
		this.hashrateDisplayInterval = setInterval(()=>{
			//console.log('render hashrate chart called');
			this.renderHashrate();
			//console.log('render hashrate chart')
		},10500)
	}
	renderHashrate(){
		 const _this = this;
		//let globalFn = this.appDirPath+'HandyMinerConfigs/globalHashrate.csv';
		let diffFn = this.appDirPath+'/HandyMinerConfigs/difficulty.jsonl';
		let localFn = this.appDirPath+'HandyMinerConfigs/localHashrate.jsonl';

		let lines;
		let localLines;
		try{
			localLines = fs.readFileSync(localFn,'utf8');
		}
		catch(e){
			console.log('caught error in locallines');
			localLines = '';
		}
		try{
			lines = fs.readFileSync(diffFn,'utf8');
		}
		catch(e){
			lines = '';
		}
		
		localLines = localLines.split('\n');
		lines = lines.split('\n');
		if(lines.length > 300){
			lines = lines.slice(-300);
			fs.writeFileSync(diffFn,lines.join('\n'),'utf8');
		}
		if(localLines.length > 300){
			localLines = localLines.slice(-300);
			fs.writeFileSync(localFn,localLines.join('\n'),'utf8');
		};

		let difficultyPerAsic = {};
		let hashratePerAsic = {};
		let fansPerAsic = {};
		let tempPerAsic = {};
		let totalHashrate = [];
		let allTimes = [];

		let dataByAsic = {};

		let hashrateJSONs = localLines.filter(function(d){
			return d.length > 0;
		}).map(function(d){
			var json = JSON.parse(d);
			return json;
		});
		let diffJSONs = lines.filter(function(d){
			return d.length > 0;
		}).map(d=>{
			return JSON.parse(d);
		});
		let lastTotalHashrate = 0;
		let lastAvgHashrate = 0;
		let lastNetworkDiff = 0;
		let lastLocalDiff = 0;
		let targetTime = moment().subtract(2,'hours').format('x');
		//console.log('targetTime',targetTime);
		console.log('last hashrate json',hashrateJSONs[hashrateJSONs.length-1])
		let filteredJSONs = hashrateJSONs;/*= hashrateJSONs.filter(line=>{
			if(line.time >= targetTime){
				return true;
			}
			return false;
		})*/
		/*hashrateJSONs*/
		//console.log('tl data',filteredJSONs);
		filteredJSONs.map((hrLine,i)=>{
			let totalSum = 0;
			let avgSum = 0;
			let timeForLine;
			let timestamp = hrLine.time;
			timeForLine = timestamp;
			allTimes.push(timestamp);
			
			//console.log('hrline',hrLine)
			Object.keys(hrLine.rates).map(asicID=>{
				if(typeof dataByAsic[asicID] == "undefined"){
					createLineObj(asicID,hrLine.rates[asicID]);
				}
				
				let hashrateData = hrLine.rates[asicID];
				hashratePerAsic[asicID].realtime.push([hashrateData.hashrateNow,timestamp])
				fansPerAsic[asicID].realtime.push([hashrateData.fan,timestamp]);
				tempPerAsic[asicID].realtime.push([hashrateData.temp,timestamp]);

				Object.keys(hashrateData.workerHashrates).map(workerID=>{
					hashratePerAsic[asicID].workers[workerID].realtime.push([hashrateData.workerHashrates[workerID].hashrateNow,timestamp])
				})
				totalSum += hashrateData.hashrateNow;
				avgSum += hashrateData.hashrateAvg;
				/*
				_this.hashRates[asicID] = {
					hashrateNow:lineD.data.hashrateNow,
					hashrateAvg:lineD.data.hashrateAvg,
					workerHashrates: lineD.data.workerHashrates,
					temp:lineD.data.temp,
					fan:lineD.data.fanRpm
				};
				*/
			});
			//console.log('last avg',lastAvgHashrate);
			lastAvgHashrate = avgSum;
			lastTotalHashrate = totalSum;
			totalHashrate.push([totalSum,timeForLine]);

			/*if(typeof diffJSONs[i] != "undefined"){
				//add diff
				let diffLine = diffJSONs[i];
				if(typeof diffLine.rates != "undefined" && Object.keys(diffLine.rates).length > 0){
					Object.keys(diffLine.rates).map(asicID=>{
						console.log('DIFFLINE',diffLine,diffLine.rates[asicID],asicID)
						let diffData = diffLine.rates[asicID];
						let timestamp = diffLine.time;
						allTimes.push(timestamp);
						difficultyPerAsic[asicID].network.push([diffData.network,timestamp]);
						difficultyPerAsic[asicID].local.push([diffData.local,timestamp]);
						lastNetworkDiff = diffData.network;
						lastLocalDiff = diffData.local;
					})
				}
			}*/
		});
		diffJSONs.map(diffLine=>{
			if(Object.keys(diffLine.rates).length > 0){
				let r0 = diffLine.rates[Object.keys(diffLine.rates)[0]];
				lastNetworkDiff	= r0.network;
				lastLocalDiff = r0.local;
			}
		})
		

		this.renderLeftStats(lastNetworkDiff,lastLocalDiff,lastTotalHashrate,lastAvgHashrate);


		let timeExtent = [targetTime,moment().format('x')]//d3.extent(allTimes);
		let totalHashrateSeries = [];
		let allDates = totalHashrate.map(d=>{
			totalHashrateSeries.push(d[0]);
			return d[1];
		});

		Object.keys(dataByAsic).map(asicID=>{
			if(typeof this.asicNames[asicID] == "undefined"){
				return;
			}
			/*
			hashratePerAsic[asicID].realtime.push([hashrateData.hashrateNow,timestamp])
			fansPerAsic[asicID].realtime.push([hashrateData.fan,timestamp]);
			tempPerAsic[asicID].realtime.push([hashrateData.temp,timestamp]);	
			difficultyPerAsic[asicID].network.push([diffData.network,timestamp]);
			difficultyPerAsic[asicID].local.push([diffData.local,timestamp]);
			*/
			let hashrateSeries = [];
			let fanSeries = [];
			let tempSeries = [];
			let diffNetworkSeries = [];
			let diffLocalSeries = [];
			let dates = [];
			let workersSeries = [];

			hashratePerAsic[asicID].realtime.map(d=>{
				dates.push(d[1])
				hashrateSeries.push(d[0])
			});
			console.log('last in series',dates[dates.length-1],hashrateSeries[hashrateSeries.length-1])
			Object.keys(hashratePerAsic[asicID].workers).map(workerID=>{
				let d = hashratePerAsic[asicID].workers[workerID];
				let workerseries = d.realtime.map(d=>{
					return d[0];
				})
				workersSeries.push({name:'Worker '+workerID,values:workerseries});
			});
			fansPerAsic[asicID].realtime.map(d=>{
				fanSeries.push(d[0])
			});
			tempPerAsic[asicID].realtime.map(d=>{
				tempSeries.push(d[0]);
			});
			difficultyPerAsic[asicID].network.map(d=>{
				diffNetworkSeries.push(d[0]);
			});
			difficultyPerAsic[asicID].local.map(d=>{
				diffLocalSeries.push(d[0]);
			});
			
			let hashrateSeriesData = [];
			hashrateSeriesData.push({name:'Hashrate',values:hashrateSeries});
			hashrateSeriesData = hashrateSeriesData.concat(workersSeries);
			
			let tempSeriesData = [];
			tempSeriesData.push({name:'Temperature',values:tempSeries});

			let fanSeriesData = [];
			fanSeriesData.push({name: 'Fan RPM',values:fanSeries});

			let diffSeriesData = [];
			diffSeriesData.push({name:'Network Diff',values:diffNetworkSeries});
			diffSeriesData.push({name:'Share Diff',values:diffLocalSeries});

			dataByAsic[asicID] = {
				dates:dates,
				difficulty:diffSeriesData,
				fans: fanSeriesData,
				temp: tempSeriesData,
				hashrate:hashrateSeriesData
			};

			renderChart(dataByAsic[asicID],asicID,'hashrate');
			renderChart(dataByAsic[asicID],asicID,'temp');
			renderChart(dataByAsic[asicID],asicID,'fans');
			if(!$('#right .asic[data-id="'+asicID+'"]').hasClass('hidden')){
				$('#right .asic[data-id="'+asicID+'"]').css({'height':'auto'});
				setTimeout(()=>{
					let h = $('#right .asic[data-id="'+asicID+'"]').height();
					$('#right .asic[data-id="'+asicID+'"]').attr('data-height',h);
					$('#right .asic[data-id="'+asicID+'"]').css({'height':h});
				},150)
			}
			
		});

		//ok now draw some charts
		let horizonElCount = 0;
		
		function DOM(name,id){
            return new Id("O-" + (name == null ? "" : name + "-" ) + id);// + (++horizonElCount));
        }
        function Id(id) {
          this.id = id;
          this.href = new URL(`#${id}`, location) + "";
        }

        Id.prototype.toString = function() {
          return "url(" + this.href + ")";
        };


       function renderChart(data,asicID,type){
			let asicName = _this.asicNames[asicID] ? asicID+'.'+_this.asicNames[asicID] : asicID;

			//console.log('chartd',data);
			const step = 23;
			let $el;
			if($('#right .asic[data-id="'+asicID+'"]').length == 0){
				$el = $('<div class="asic" data-id="'+asicID+'"><div class="name">'+asicName+'</div></div>')
				$('#right').append($el);
			}
			else{
				$el = $('#right .asic[data-id="'+asicID+'"]');
			}
			if($('svg.'+type,$el).length == 0){
				$el.append('<svg class="'+type+'" data-id="'+asicID+'" />')
			}

			//horizonElCount = 4;// data.hashrate.length;
			const svg = d3.select($el[0]).select('svg[data-id="'+asicID+'"].'+type);
			$('svg[data-id="'+asicID+'"].'+type,$el).css('height',step*data[type].length)
			
			let width = $('#right.halfChart').width();
			let height = $('#right.halfChart').height();
			let margin = ({top: 0, right: 0, bottom: 0, left: 0})
			let overlap = 6;
			let colorScheme;
			let labelSuffix = '';
			switch(type){
				case 'hashrate':
					colorScheme = 'schemePurples';
					labelSuffix = 'GH';
				break;
				case 'temp':
					colorScheme = 'schemeYlOrRd';
					labelSuffix = '°C';
					overlap = 6;
				break;
				case 'fans':
					colorScheme = 'schemePuBu';
					labelSuffix = 'RPM'
					overlap = 6;
				break;
			}
			let color = (i) => d3[colorScheme][Math.max(3, overlap)][i + Math.max(0, 3 - overlap)]
			let greyscale = (i) => d3['schemeGreys'][Math.max(3, overlap)][i + Math.max(0, 3 - overlap)]
			let ylGn = (i) => d3['schemeYlGn'][Math.max(3, overlap)][i + Math.max(0, 3 - overlap)]
			
			let x = d3.scaleUtc()
			    .domain(d3.extent(data.dates))
			    .range([0, width]);
			let y = d3.scaleLinear()
			    .domain([0, d3.max(data[type], d => d3.max(d.values))])
			    .range([0, -overlap * step])

			let area = d3.area()
			    .curve(d3.curveBasis)
			    .defined(d => !isNaN(d))
			    .x((d, i) => x(data.dates[i]))
			    .y0(0)
			    .y1(d => y(d));

			let xAxis = g => g
			    .attr("transform", `translate(0,${margin.top})`)
			    .call(d3.axisTop(x).ticks(width / 80).tickSizeOuter(0))
			    .call(g => g.selectAll(".tick").filter(d => x(d) < margin.left || x(d) >= width - margin.right).remove())
			    .call(g => g.select(".domain").remove());
			let chartData = data[type].map((d,i) => Object.assign({
		      clipId: DOM("clip"+type+asicID,i),
		      pathId: DOM("path"+type+asicID,i)
		    }, d))    
			const g = svg
				.selectAll('g.main')
				.data(chartData)
				.join('g')
				//.append("g")
				.classed('main',true)
			      //.classed(asicID,true)
			      .attr("transform", (d, i) => `translate(0,${i * (step + 1)})`);
			let cPath = g.selectAll('clipPath')
			  .data(d=>{return [d];})
			  .join('clipPath')
			  //.append("clipPath")
		      	.attr("id", d => { return d.clipId.id;});

		    cPath.selectAll('rect')
		      .data(d=>{return [d];})
		      //.append("rect")
		      .join('rect')
			    .attr("width", width)
			    .attr("height", step);;

		    let defs = g.selectAll('defs')
		      .data(d=>{return [d];})
		      .join('defs');
		    defs.selectAll('path')
		      .data(d=>{return [d];})
		      .join('path')
		      //.append("path")
		      .attr("id", d => d.pathId.id)
		      .transition()
		      .duration(300)
		      .attr("d", d => area(d.values));
		    let gClipPath = g.selectAll('g')
		      .data(d=>{return [d];})
		      //append("g")
		      .join('g')
		      .attr("clip-path", d => 'url('+d.clipId.href+')')
		    
		    gClipPath.selectAll("use")
		    .data(d => new Array(overlap).fill(d))
		    .join("use")
		      .attr("fill", (d, i) => {
		      	let rgb = d3.rgb(greyscale(i));
		      	//console.log('fill color',rgb,d);
		      	return rgb
		      })
		      .on('mouseenter',function(d,i){
		      	d3.select(this.parentNode).selectAll('use')
		      		.transition()
		      		.duration(100)
		      		.attr("fill", (d, i) => {
		      			let rgb;
				      	if((d.name == 'Hashrate') || type != 'hashrate') {

				      		rgb = d3.rgb(color(i));
				      	}
				      	else{
				      		rgb = d3.rgb(ylGn(i));
				      	}
				      	//console.log('fill color',rgb,d);
				      	return rgb
				    })
		      	return;
		      })
		      .on('mouseleave',function(d,i){
		      	d3.select(this.parentNode).selectAll('use')
		      		.transition()
		      		.duration(100)
		      		.attr("fill", (d, i) => {
				      	let rgb = d3.rgb(greyscale(i));
				      	//console.log('fill color',rgb,d);
				      	return rgb
				    })
		      	return;
		      })
		      .attr('stroke','rgba(200,200,200,0.6')
		      .attr("transform", (d, i) => `translate(0,${(i + 1) * step})`)
		      .attr("xlink:href", d => d.pathId.href);
		    g.selectAll('text')
		    	.data(d=>{return [d];})
		    	.join('text')
		    //.append("text")
			      .attr("x", 4)
			      .attr("y", step / 2)
			      .attr("dy", "0.35em")
			      .text(d => d.name+': '+d.values[d.values.length-1]+labelSuffix)
			      .on('mouseenter',function(d,i){
			      	d3.select(this.parentNode).selectAll('use')
			      		.transition()
			      		.duration(100)
			      		.attr("fill", (d, i) => {
			      			let rgb;
					      	if((d.name == 'Hashrate') || type != 'hashrate') {

					      		rgb = d3.rgb(color(i));
					      	}
					      	else{
					      		rgb = d3.rgb(ylGn(i));
					      	}
					      	//console.log('fill color',rgb,d);
					      	return rgb
					    })
			      	return;
			      })
			      .on('mouseleave',function(d,i){
			      	d3.select(this.parentNode).selectAll('use')
			      		.transition()
			      		.duration(100)
			      		.attr("fill", (d, i) => {
					      	let rgb = d3.rgb(greyscale(i));
					      	//console.log('fill color',rgb,d);
					      	return rgb
					    })
			      	return;
			      })
			$('text','svg[data-id="'+asicID+'"].'+type).eq(0).addClass('first');
			$('svg[data-id="'+asicID+'"].hashrate path').eq(0).addClass('first');

			/*svg.append("g")
			    .call(xAxis);*/

		}
		function createLineObj(asicID,hrLast){
			//create obj if doesnt exist
			dataByAsic[asicID] = {
				dates:[],
				series:[]
			}
			if(typeof difficultyPerAsic[asicID] == "undefined"){
				difficultyPerAsic[asicID] = {
					network:[],
					local:[]
				};
			}

			let workerHRObj = {};
			Object.keys(hrLast.workerHashrates).map(workerID=>{
				workerHRObj[workerID] = {
					realtime:[]
				}
			});
			if(typeof hashratePerAsic[asicID] == "undefined"){
				hashratePerAsic[asicID] = {
					realtime:[],
					workers:workerHRObj
				};
				fansPerAsic[asicID] = {
					realtime:[]
				};
				tempPerAsic[asicID] = {
					realtime:[]
				}
			}
		}

	}
	renderLeftStats(lastNetworkDiff,lastLocalDiff,lastTotalHashrate,lastAvgHashrate){
		let $el = $('#left');
		$('.totalHashrate .value',$el).html(numeral(lastTotalHashrate).format('0.00')+'GH');
		$('.avgHashrate .value',$el).html(numeral(lastAvgHashrate).format('0.00')+'GH');
		$('.networkDiff .value',$el).html(numeral(lastNetworkDiff).format('0a').toUpperCase());
		$('.localDiff .value',$el).html(numeral(lastLocalDiff).format('0a').toUpperCase());
		/*
		<div class="leftInfo totalHashrate">
				<div class="value">---GH</div>
				<div class="label">Total Hashrate</div>
			</div>
			<div class="leftInfo avgHashrate">
				<div class="value">---GH</div>
				<div class="label">Avg Hashrate</div>
			</div>
			<div class="leftInfo networkDiff">
				<div class="value">---</div>
				<div class="label">Network Diff</div>
			</div>
			<div class="leftInfo localDiff">
				<div class="value">---</div>
				<div class="label">Share Diff</div>
			</div>
		*/
	}
	renderLastBlocks(blocks){
		let tempBlocks = {};
		let filtered = Object.keys(blocks).filter(k=>{
			return blocks[k] != null;
		}).map(k=>{
			tempBlocks[k] = blocks[k];
		});
		blocks = tempBlocks;
		

		//render chart of the last 100 blocks
		var svg = d3.select('#left.halfChart svg');
		svg.selectAll('g').remove();
		let bData = Object.keys(blocks);
		bData = bData.map(function(k){
			return blocks[k];
		});
		let w = $('#left.halfChart').width();
		let h = $('#left.halfChart').height();
		let padding = {l:36,t:5,r:5,b:20};
		let newblocks = {};
		Object.keys(blocks).map(k=>{
			if(typeof blocks[k] != "undefined"){
				newblocks[k] = blocks[k];
			}
		});
		blocks = newblocks;
		let xExtent = d3.extent(Object.keys(blocks),function(d){
			return blocks[d].height;
		});
		
		let diffExtent = d3.extent(Object.keys(blocks),function(d){
			return blocks[d].difficulty;
		});
		bData = [{height:xExtent[0],difficulty:diffExtent[0]}].concat(bData);
		bData = bData.concat([{height:xExtent[1],difficulty:diffExtent[0]}]);
		let path = svg.selectAll('path').data([bData]);
		
		
		let xScale = d3.scaleLinear()
			.range([padding.l,w-padding.r])
			.domain(xExtent);
		let yScale = d3.scaleLinear()
			.range([h-padding.b,padding.t])
			.domain(diffExtent);
		let axisL = d3.axisLeft(yScale).ticks(5).tickFormat(d=>numeral(d).format('0.0a'));
		let axisB = d3.axisBottom(xScale).ticks(5);

		let line = d3.line()
			.x(function(d){
				return xScale(d.height);
			})
			.y(function(d){
				return yScale(d.difficulty);
			});
		svg.append('g')
			.attr('transform','translate(35,0)')
			.call(axisL);
		svg.append('g')
			.attr('transform','translate(0,'+(h-20)+')')
			.call(axisB);

		path.transition()
			.attr('d',line);
		path.enter()
			.append('path')
			.classed('line',true)
			.transition()
				.attr('d',line);
		path.exit().remove();
	}
	startTimer(){
		return false; //deprecating for goldshell
		const _this = this;
		if(typeof this.timer != "undefined"){
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(function(){

			if(_this.canFetchNetworkTimeline){
				$.post('http://x:'+_this.hsdConfig.apiKey+'@'+_this.hsdURL,JSON.stringify({params:[],method:'getmininginfo'}),function(d){
					//console.log('got mining info?',d);
					let hr = d.result.networkhashps;
					let time = new Date().getTime();
					let line = [hr,time].join(',')+'\n'
					fs.appendFile(process.env.HOME+'/.HandyMiner/globalHashrate.csv',line,function(err,d){});
					
					_this.syncBlocks(d.result.blocks);
					let heightNow = d.result.blocks;
					
					$('.title a').attr('href','http://hnscan.com/block/'+heightNow).html(heightNow);

					_this.renderHashrate();
					$('#logs.required').hide(); //means we can hide install logs
					
				});
				if(Object.keys(_this.hashRates).length > 0){
					let hrLine = JSON.stringify({rates:_this.hashRates,time:new Date().getTime()})+'\n';
					fs.appendFile(process.env.HOME+'/.HandyMiner/localHashrate.json',hrLine,function(err,d){})
				}
			}
			else{
				$.post('http://x:'+_this.hsdConfig.apiKey+'@'+_this.hsdURL,JSON.stringify({params:[],method:'getmininginfo'}),function(d){
					//console.log('got mining info?',d);
					console.log('mining infos?',d);
					let heightNow = d.result.blocks;
					if(typeof _this.syncHeight == "undefined"){
						_this.syncHeight = 0;
					}
					if(_this.syncHeight == heightNow && heightNow != 0 && (Math.abs(heightNow - _this.peersGreatestHeight) < 10) || (_this.peersGreatestHeight == 0 && _this.hsdInfo.peers.length == 0)){
						console.log('might be done syncing me thinks..');

						_this.lastKnownHeight = heightNow;
						_this.getHSDNetworkInfo();
						
					}
					else{
						console.log('syncheight ',_this.syncHeight,heightNow);
					}
					_this.syncHeight = heightNow;
					
				});

			}
			_this.startTimer();

		},20000);

		
	}
	showLoading(){
		$('#loading').show();
	}
	hideLoading(){
		$('#loading').hide();
	}
	syncBlocks(startAtBlock){
		const _this = this;
		let blocks = this.last100Blocks;
		console.log('syncBlock startat',startAtBlock);
		$.post('http://x:'+this.hsdConfig.apiKey+'@'+this.hsdURL,JSON.stringify({params:[startAtBlock,true,false],method:'getblockbyheight'}),function(d){
			//console.log('got block info?',d);
			_this.last100Blocks[startAtBlock] = d.result;
			
			let tx = d.result.tx[0];
			$.get('http://x:'+_this.hsdConfig.apiKey+'@'+_this.hsdURL+'/tx/'+tx,function(d){
				_this.last100Blocks[startAtBlock]._txDetail = d;
				if(d.outputs[0].address == _this.hsdWallet){
					_this.last100Blocks[startAtBlock].isMyBlock = true;
				}
				console.log('startat block is defined?',parseInt(startAtBlock)-1,blocks[parseInt(startAtBlock)-1]);
				if(typeof blocks[parseInt(startAtBlock)-1] == "undefined"){
					_this.syncBlocks(parseInt(startAtBlock)-1);
				}
				else{
					//done!
					_this.renderLastBlocks(_this.last100Blocks);
				}
			});
			
		});
	}
	startMiner(){
		this.isMining = true;
		process.env.HANDYRAW = 'true';
		if(typeof this.minerProcess != "undefined"){
			this.minerProcess.kill();
			this.hashRates = {};
		}
		fs.writeFileSync(nw.__dirname+'/submodules/HandyMiner-Goldshell-CLI/goldshell.json',JSON.stringify(this.config,null,2),'utf8'); //make a default config

		const handyMinerParams = [
			'./mine.js',
			this.config.asics,
			'',//this.config.gpu_platform,
			'',//this.config.gpu_mfg,
			'authorize',
			'',//this.hsdConfig.wallet,
			this.config.stratum_user,
			this.config.stratum_pass,
			this.config.host,
			this.config.port,
			this.config.intensity || "10",
			this.config.mode || "pool",
			this.config.poolDifficulty || -1,
			(this.config.muteFanfareSong ? "1" : "0")
		];
		let executable = process.platform.toLowerCase().indexOf('darwin') == 0 ? process.execPath : nw.global.__dirname+'/externals/node.exe';
		process.env.HANDYMINER_GUI_NODE_EXEC = executable;
		let minerProcess = spawn(executable,
			handyMinerParams,
			{
				cwd:nw.__dirname+'/submodules/HandyMiner-Goldshell-CLI/',
				env:process.env
			});
		this.minerProcess = minerProcess;
		//console.log('miner process isset???',minerProcess);
		
		minerProcess.stderr.on('data',(d)=>{
			this.pushToLogs(d.toString('utf8'),'error','miner');
			console.log('data err',d.toString('utf8'));
		})

		minerProcess.stdout.on('data',(d)=>{
			//console.log('miner stdout',d.toString('utf8'));
			let lines = d.toString('utf8');
			lines = lines.split('\n').filter(l=>{
				return l.length > 0;
			});
			lines.map(line=>{
				let t = 'stdout';

				if(line.indexOf('"type":"error"') >= 0){
					t = 'error';
				}
				//console.log('logs here',d.toString('utf8'),t);
				this.pushToLogs(line,t,'miner');
			})
			

			this.parseMinerOut(d.toString('utf8'));
			
		});
		minerProcess.on('close',function(){
			//done
			this.isMining = false;
			console.log('miner process closed?');
		});
	}
	stopMiner(){

		if(typeof this.minerProcess != "undefined"){
			try{
	  			this.minerProcess.stdin.write('dashboard sigint');
	  		}
	  		catch(e){

	  		}
			//this.minerProcess.kill();
			this.isMining = false;
			this.hashRates = {};
			$('.gpuIcon').each(function(){
				$('li',this).eq(1).html('--GH')
			});
			$('.leftInfo.totalHashrate .value').html('--GH')
			$('.leftInfo.avgHashrate .value').html('--GH');
			d3.selectAll('#right svg text').each(function(d){
				if(d.name == 'Hashrate' || d.name.indexOf('Worker') >= 0){
					d3.select(this).text(d.name+': --GH')
				}
				if(d.name == "Temperature"){
					d3.select(this).text(d.name+': --°C')
				}
				if(d.name == 'Fan RPM'){
					d3.select(this).text(d.name+': ----RPM')
				}
			})

		}
	}
	parseMinerOut(text){
		const _this = this;
		let lines = text.split('\n').filter(l=>{
			return l.length > 0;
		});
		lines.map(function(line){
			let lineD;

			try{
				lineD = JSON.parse(line.trim());
			}
			catch(e){
				//console.log('error parsing json',e);
			}
			if(lineD){
				//console.log('lineD isset',lineD);
				let asicID;
				switch(lineD.type){
					case 'job':
					//got a new job
					//should query/update charts?
					break;
					case 'solution':
						//epic, get ready for confirmation
						_this.awaitingConfirmation = true;
					break;
					case 'registration':
						//add gpus to main
						console.log('registration event',lineD);
						if(typeof lineD.data.length != "undefined"){
							//empty registration passes back empty array vs object per machine
							//alert user
							$('.syncedIcon').addClass('alert').addClass('noAsicAlert');
							$('.statusPrefix').html('');
							$('.syncedButton .statusLabel').html('No ASICs detected');
							$('.syncedButton').show();

						}
						else{
						    if($('.syncedIcon').hasClass('noAsicAlert')){
						    	$('.syncedIcon').removeClass('alert').removeClass('noAsicAlert').addClass('success')
								$('.statusPrefix').html('');
								$('.syncedButton .statusLabel').html('Detected ASIC: '+lineD.data.serialPort);
								$('.syncedButton').fadeOut(1000);
						    }
						}
						let $tmpl = $('#gpuTemplate').clone();
						$tmpl.removeAttr('id');
						//let gpuArr = gpus.split(',');
						//$('.gpuStatus .gpuIcon').remove();
						/*
						.data
						{
							serialPort:serialPath,
							modelName,
							firmwareVersion:fwVersion,
							serial,
							hashRate,
							workDepth
						};
						*/
						//console.log('new machine registered',lineD);
						_this.asicNames[lineD.data.serialPort] = lineD.data.modelName;
						if($('.gpuIcon[data-id="'+lineD.data.serialPort+'"]').length == 0){
							let t = $tmpl.clone();
							t.attr('data-id',lineD.data.serialPort);
							t.addClass('gpuIcon');
							let shortName = lineD.data.serialPort;
							if(shortName.length > 4){
								shortName = '...'+shortName.slice(-4);
							}
							$('li',t).eq(0).html(shortName+'.'+lineD.data.modelName+'<small>'+lineD.data.serial.slice(1)+'</small>');
							$('li',t).eq(1).html('--GH');
							$('.gpuStatus').append(t);
						}
						else{
							$('.gpuIcon[data-id="'+lineD.data.serialPort+'"]').removeClass('disconnected');
							$('.halfChart .asic[data-id="'+lineD.data.serialPort+'"]').removeClass('disconnected')
						}
						$('.gpuIcon[data-id="'+lineD.data.serialPort+'"]').off('mouseenter').on('mouseenter',()=>{
							if($('.gpuIcon.clicked').length == 0){
								$('.halfChart#right .asic').addClass('hidden');
								$('.halfChart#right .asic[data-id="'+lineD.data.serialPort+'"]').removeClass('hidden');
							}
						}).off('mouseleave').on('mouseleave',function(){
							if($('.gpuIcon.clicked').length == 0){
								$('.halfChart#right .asic').removeClass('hidden');
							}
						}).off('click').on('click',function(){
							console.log("clicked");
							let isClicked = $(this).hasClass('clicked');
							if(isClicked){
								$('.gpuIcon').removeClass('clicked');
								$('#right .asic').removeClass('hidden');
							}
							else{
								$('.gpuIcon').not($(this)).removeClass('clicked');
								$(this).addClass('clicked');
								$('.halfChart#right .asic').addClass('hidden');
								$('.halfChart#right .asic[data-id="'+lineD.data.serialPort+'"]').removeClass('hidden');
								if($('.halfChart#right .asic[data-id="'+lineD.data.serialPort+'"]').attr('data-height')){
									$('.halfChart#right .asic[data-id="'+lineD.data.serialPort+'"]').css('height',$('.halfChart#right .asic[data-id="'+lineD.data.serialPort+'"]').attr('data-height'))
							}	}
						})
						_this.resizeStatsPanel();
						//_this.startHashrateChartTicks();
					break;
					case 'difficulty':
						//console.log('difficulty data recv',lineD);
						/*
						case 'difficulty':
							this.statsData.difficulty = json.difficulty;
							this.statsData.networkDifficulty = json.networkDifficulty;
							this.statsData.target = json.target;
							this.updateStats(this.statsData.target,'target');
						break;
						*/
						asicID = lineD.asic;
						let localDifficulty = lineD.difficulty;
						let networkDifficulty = lineD.networkDifficulty;

						_this.difficulty[asicID] = {
							local:localDifficulty,
							network:networkDifficulty
						};


					break;
					case 'status':
					case 'asicStats':
						/*
						data:{
				            temp:this.asicStats[asicID].temp,
				            fanRpm: this.asicStats[asicID].fanRpm,
				            voltage: this.asicStats[asicID].voltage,
				            frequency: this.asicStats[asicID].frequency,
				            asicID: asicID,
				            name: this.asicNames[asicID].modelName,
				            serial: this.asicNames[asicID].serial,
				            hashrateNow: Math.round(perAsicRateNow[asicID]*100)/100,
				            hashrateAvg: Math.round(perAsicRateAvg[asicID]*100)/100,
				            workerHashrates:workerHashrates,
				            solutions: this.asicShares[asicID],
				            lastNonce: this.asicJobHashrates[asicID+'_'+1].last
				          }
						*/
						//gpu status
						let hashRate = lineD.data.hashrateNow;
						asicID = lineD.data.asicID;

						/*let gpuID = lineD.data[0].gpuID;
						let hashRate = lineD.data[0].hashRate;*/
						//
						_this.hashRates[asicID] = {
							hashrateNow:lineD.data.hashrateNow,
							hashrateAvg:lineD.data.hashrateAvg,
							workerHashrates: lineD.data.workerHashrates,
							temp:lineD.data.temp,
							fan:lineD.data.fanRpm
						};
						let hrLine = JSON.stringify({rates:_this.hashRates,time:new Date().getTime()})+'\n';
						fs.appendFileSync(_this.appDirPath+'HandyMinerConfigs/localHashrate.jsonl',hrLine,'utf8');
						//write difficulty here because it's more regular
						
						let diffLine = JSON.stringify({rates:_this.difficulty,time:new Date().getTime()})+'\n';
						fs.appendFileSync(_this.appDirPath+'HandyMinerConfigs/difficulty.jsonl',diffLine,'utf8')
						
						//console.log('hashrates recvd',lineD);
						$('.gpuIcon[data-id="'+asicID+'"] li').eq(1).html(numeral(hashRate).format('0.00')+'GH')
						if(parseFloat(hashRate) > 0){
							console.log('render hashrate then',hashRate,_this.hashRates);
							_this.renderHashrate();
						}
						/*if(hashRate > 0 && hashRate < 1000000000){
							_this.hashRates[gpuID] = hashRate;
							//console.log('hashrate: ',hashRate);
							$('.gpuIcon[data-id="'+gpuID+'"] li').eq(1).html(numeral(hashRate).format('0.000b').replace('B','H'))
						}*/
					break;

					case 'stratumLog':
						//just logs
					break;
					case 'confirmation':
						//console.log('confirmation???',lineD);
						//won a block/share
						//if(_this.awaitingConfirmation){
						//if(typeof lineD.granule != "undefined"){
							//it sends out 2 messages with confirmation
							//we just want to fire this 1x
							_this.tickBlockConfirmation();
							_this.awaitingConfirmation = false;
						//}
						/*}
						else{
							$.post('http://x:'+apiKey+'@'+_this.hsdURL,JSON.stringify({params:[],method:'getmininginfo'}),function(d){
								console.log('got mining info?',d);
								//do nothing
								
								//success, we can just leave things hidden
							}).fail(function(){
								_this.tickBlockConfirmation();
								_this.awaitingConfirmation = false;
							})
						}*/
					break;
				}
			}
		})
	}
	tickBlockConfirmation(){

		this.blocksSolvedLast24++;
		this.allTimeBlocks++;
		let formatSmallSession = this.blocksSolvedLast24 > 1000 ? '0.0a' : '0a';
		let formatSmallAllTime = this.allTimeBlocks > 1000 ? '0.0a' : '0a';
		$('.blocksToday .number').html(numeral(this.blocksSolvedLast24).format(formatSmallSession).toUpperCase())
		$('.blocksAllTime .number').html(numeral(this.allTimeBlocks).format(formatSmallAllTime).toUpperCase());
		//let bc = parseInt($('.title a').html())+1;
		//$('.title a').attr('href','http://hnscan.com/block/'+bc).html(bc)
		//console.log('write confirm',this.appDirPath+'HandyMinerConfigs/allTimeBlocks.json')
		fs.writeFileSync(this.appDirPath+'HandyMinerConfigs/allTimeBlocks.json',JSON.stringify({count:this.allTimeBlocks}),'utf8');

	}
	checkDockerSupport(isFirstTimeLaunch){
		//check if we have docker support
		const _this = this;
		let checker = spawn('docker',['ps','-a']);
		let resp = '';
		/*
		let hsdLogs = '';
		console.log('should cwd to ',nw.__dirname+'/submodules/HandyMiner-CLI/node_modules/hsd')
		this.hsdProcess = hsdProcess;
		this.hsdProcess.stderr.on('data',function(d){
			console.log('hsd stderr',d.toString('utf8'))
			$('#logOutput').append(d.toString('utf8'));
			$('#logs').removeClass('required');
		})
		this.hsdProcess.stdout.on('data',function(d){
			console.log('hsd stdout',d.toString('utf8'));
			hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}
			if(isFirstTimeLaunch){
				$('#logOutput').html(hsdLogs);
			}
		});
		*/
		let hsdLogs = '';
		checker.stdout.on('data',d=>{
			//console.log('checker data',d.toString('utf8'));
			resp += d.toString('utf8');
			hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}
			if(isFirstTimeLaunch){
				$('#logOutput').html(hsdLogs);
			}
		});
		checker.stderr.on('data',d=>{
			$('#logOutput').append(d.toString('utf8'));
			$('#logs').removeClass('required');
			console.log('checker error',d.toString('utf8'));
		})
		checker.on('close',d=>{
			//checker is done, lets look around
			console.log('checker is done');
			let lines = resp.split('\n');
			let earthLine = lines.filter(l=>{
				return l.indexOf('earthlabHSD') >=0;
			});
			console.log('earthLine len',earthLine.length)
			if(earthLine.length > 0){
				if(earthLine[0].indexOf('Exited') >= 0){
					//this machine was exited
					console.log('machine is down');
					_this.pushToLogs('#### DOCKER:: BOOTING HSD DOCKER CONTAINER #####','stdout','hsd')
					$('.syncedIcon').removeClass('alert');
					$('.syncedButton .statusLabel').html('Booting Docker Container')
					this.startExistingDockerMachine();
				}
				else{
					//heyo machine is running
					console.log('docker machine is already running');
					_this.pushToLogs('#### DOCKER:: STARTING HSD ON DOCKER CONTAINER #####','stdout','hsd')
					$('.syncedIcon').removeClass('alert');
					$('.syncedButton .statusLabel').html('Starting HSD in Docker')
					this.startDockerizedHSD();
				}
			}
			else{
				//no line = no docker box
				console.log('no docker machine was present, lets make one');
				_this.pushToLogs('#### DOCKER:: STARTING NEW HSD DOCKER MACHINE, THIS WILL TAKE 2-5 MINUTES #####','stdout','hsd');
				$('.syncedIcon').removeClass('alert');
				$('.syncedButton .statusLabel').html('Building Brand New Docker Machine. This will take 2-5 minutes only once..')
				this.startNewDockerMachine(isFirstTimeLaunch);
			}
		})
	}
	pushToLogs(line,type,context){
		//context = miner | hsd
		if(context == 'hsd'){
			if(type == 'stdout' && line.indexOf('[debug]') >= 0){
				return;
			}
			this.hsdLogs += line;
			if(line.indexOf('chain/LOCK:') >= 0 && line.indexOf('Resource temporarily unavailable') >= 0){
				///left off here
				this.hsdLogs += '\r\n #############################################################';
				this.hsdLogs += '\r\n ########## WARNING HSD IS ALREADY RUNNING LOCALLY ###########';
				this.hsdLogs += '\r\n #############################################################\r\n';
				this.hsdIsRunningLocally = true;
				$('.syncedIcon').removeClass('alert');
				$('.syncedButton .statusLabel').html('Found Running HSD Instance Locally');
			}
			else{
				if(!this.hsdIsRunningLocally && (process.platform.indexOf('darwin') >= 0 && !this.macUseDocker)){
					$('.syncedIcon').addClass('alert');
					$('.syncedButton .statusLabel').html('Failed to start HSD');
				}
			}
			if(this.hsdLogs.length >= 100000){
				this.hsdLogs = this.hsdLogs.slice(-5000);
			}
			if(this.logsVisible){
				$('#logs pre#logOutput').html(this.hsdLogs);
				$('#logs pre#logOutput')[0].scrollTop = $('#logs pre#logOutput')[0].scrollHeight;
			}
		}
		if(context == 'miner'){
			this.minerLogs += line;
			
			if(this.minerLogs.length >= 20000){
				this.minerLogs = this.minerLogs.slice(-10000);
			}
			//if(this.logsVisible){
				//console.log('logs vis?????')
				$('#logs pre#minerOutput').html(this.minerLogs);
				$('#logs pre#minerOutput')[0].scrollTop = $('#logs pre#minerOutput')[0].scrollHeight;
			//}
		}
		
		let j = JSON.parse(line);
		//console.log('line data',j,j.type,j.data);
		if(j.type == 'stratumLog' && $('.syncedIcon').hasClass('alert') && !$('.syncedIcon').hasClass('noAsicAlert') && j.data == 'Successfully Registered With Stratum'){
			//reconnected then
			$('.syncedIcon').removeClass('alert').addClass('success');
			$('.syncedButton .statusLabel').html('Connected To Pool');
			$('.syncedButton').fadeOut(1000);
		}		
		if(type == 'error'){
			if(j.disconnected){
				//asic was disconnected
				let asicID = j.data.asicID;
				console.log('asic id discon',asicID)
				$('.gpuIcon[data-id="'+asicID+'"]').addClass('disconnected');
				$('.logs').addClass('alerted');
				$('.halfChart .asic[data-id="'+asicID+'"]').addClass('disconnected')
			}
			if(j.message.indexOf('STRATUM CONNECTION WAS CLOSED') == -1){
				$('.logs').addClass('alerted');
			}
			if(j.message.indexOf('RECONNECTING NOW') >= 0 && !$('.syncedIcon').hasClass('noAsicAlert')){
				$('.syncedIcon').addClass('alert');
				$('.statusPrefix').html('');
				$('.syncedButton .statusLabel').html('Connecting to Pool...');
				$('.syncedButton').show();

			}

			/*
				$('.syncedIcon').addClass('alert');
					$('.syncedButton .statusLabel').html('Failed to start HSD');
			*/

			console.log('error was found???',j,j.disconnected);
		}

		/*if(type == 'error'){
			
			$('.logs').addClass('alerted');
		}*/
		//console.log('line pushed',line,line.indexOf('chain/LOCK:'),line.indexOf('Resource temporarily unavailable'));

		
		//TODO: make notication button to show logs
	}
	startDockerizedHSD(){
		this.hasLogged = false;
		let envVars = process.env;
		//envVars.PATH = "C:\\Program\ Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\bin"+';'+process.env.PATH;
		//let hsdProcess = spawn('docker',['exec','earthlab','sh','-c','"./bin/hsd '+(this.hsdParams.join(' '))+'"']/*,{env:envVars}*/);
		let wallet = this.hsdConfig.wallet || this.hsdWallet;
		console.log('docker is set to mine to wallet:: ',wallet,this.config.network);
		//if no wallet fill in with one
		if(wallet == ''){
			wallet = this.defaultWallet
		}
		let hsdProcess = spawn('docker',['exec','-i','earthlabHSD','sh','-c','"./run.sh\ '+wallet+'\ '+(this.config.network || 'main')+'"'],{shell:true})
		//let hsdLogs = '';
		hsdProcess.stdout.on('data',d=>{
			//console.log('hsd data',d.toString('utf8'));
			if(!this.hasLogged){
				this.hsdIsRunningLocally = true;
				this.hasLogged = true;
				this.hideLoading();
				setTimeout(()=>{
					this.addPeers();
				},1000);
			}
			
				
				
			this.pushToLogs(d.toString('utf8'),'stdout','hsd');


		})
		hsdProcess.stderr.on('data',d=>{
			//console.log('hsd error',d.toString('utf8'));
			//hsdLogs += d.toString('utf8');
			this.pushToLogs(d.toString('utf8'),'error','hsd');
		})
		hsdProcess.on('close',d=>{
			console.log('hsd process closed');
		});
		this.hsdProcess = hsdProcess;
		this.initLogo();
		setTimeout(()=>{
			this.getHSDNetworkInfo();
			
			//_this.startTimer();
		},3000)
	}
	stopDockerizedHSD(){
		this.restartDockerContainer(false);
		this.hsdProcess.kill();
	}
	stopDockerMachine(){
		this.restartDockerContainer(false);
		let fin = spawn('docker',['stop','earthlabHSD']);
		fin.on('close',d=>{
			return;
		});
	}
	startExistingDockerMachine(){
		let startD = spawn('docker',['start','earthlabHSD']);
		startD.stdout.on('data',d=>{
			console.log('startD data',d.toString('utf8'));
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'stdout','hsd');
		})
		startD.stderr.on('data',d=>{
			console.log('startD error',d.toString('utf8'));
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'error','hsd');
		})
		startD.on('close',d=>{
			this.startDockerizedHSD();
			console.log('started existing docker box!')
		})
	}
	startNewDockerMachine(){
		//first we'll create the docker machine
		//first lets check if docker ls lists any eartlabs...
		let hsdLogs = '';
		let listData = '';
		let listD = spawn('docker',['image','ls']);
		listD.stdout.on('data',d=>{
			listData += d.toString('utf8');
			hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}
			//$('#logOutput').html(hsdLogs);
			$('.syncedButton .statusLabel').html('Building Brand New Docker Machine. This will take 2-5 minutes only once..')
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'stdout','hsd');
		});
		/*listD.stderr.on('dtaa',d=>{

		})*/
		listD.on('close',d=>{
			$('.syncedButton .statusLabel').html('Built Docker Container!')
			console.log('start listD stdout',listData,listData.indexOf('earthlab'));
			if(listData.indexOf('earthlab') == -1){
				//we dont need to build image
				this.createDockerImage();
			}
			else{
				this.createDockerContainer();
			}
		});

		
	}
	
	createDockerImage(){
		let wasError = false;
		let createD = spawn('docker',['build', '-t', 'earthlab', '.'],{cwd:nw.__dirname+'/submodules/HandyMiner-CLI/windows_utils'});
		console.log('create image was called');
		let hsdLogs = '';
		createD.stdout.on('data',d=>{
			console.log('creating docker machine',d.toString('utf8'));
			//here
			/*hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}*/
			//$('#logOutput').html(hsdLogs);
			$('.syncedIcon').removeClass('alert');
			$('.syncedButton .statusLabel').html('Creating Docker Image. This may take 2-5 minutes only once..');
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'stdout','hsd');
		})
		createD.stderr.on('data',d=>{	
			wasError = true;
			/*hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}
			$('#logOutput').html(hsdLogs);*/
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'error','hsd');
			$('.syncedIcon').addClass('alert');
			$('.syncedButton .statusLabel').html('ERROR CREATING DOCKER IMAGE')
			$('#logs').removeClass('required');
			console.log('err create docker machine',d.toString('utf8'));
		})
		createD.on('close',d=>{
			//we should now make our container
			console.log('createD is closed now',wasError);
			if(!wasError){
				this.createDockerContainer();
			}
		})
	}
	createDockerContainer(){
		let wasContainerError = false;
		let hsdLogs = '';
		console.log('create docker container called');
		let containerD = spawn('docker', ['run', '-p', '13937:13037', '-p', '13938:13038', '-p', '14937:14037','-p','14938:14038', '-p', '12937:12037', '-p', '12938:12038', '-p', '3008:3008', '-p', '15937:15037', '-p', '15938:15038', '-p', '5301:5301', '-p', '13038:13038', '-p', '15359:15359', '--expose', '3008', '--name', 'earthlabHSD', '-td', 'earthlab'],{cwd:nw.__dirname+'/submodules/HandyMiner-CLI/windows_utils'});
		containerD.stdout.on('data',d=>{
			/*hsdLogs += d.toString('utf8')+'\r\n';
			if(hsdLogs.length >= 15000){
				hsdLogs = hsdLogs.slice(-10000);
			}
			$('#logOutput').html(hsdLogs);*/
			$('.syncedIcon').removeClass('alert');
			$('.syncedButton .statusLabel').html('Creating Docker Container. This may take 2-5 minutes only once..')
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'stdout','hsd');
			console.log('container creation data',d.toString('utf8'));
		})
		containerD.stderr.on('data',d=>{
			wasContainerError = true;
			/*hsdLogs += d.toString('utf8');
			$('#logOutput').html(hsdLogs);
			$('#logs').removeClass('required');*/
			this.pushToLogs('## DOCKER:: '+d.toString('utf8'),'error','hsd');
			$('.syncedIcon').addClass('alert');
			$('.syncedButton .statusLabel').html('Error creating Docker container')
			console.log('container creation ERROR',d.toString('utf8'));
		});
		containerD.on('close',d=>{
			console.log('containerD was closed');
			if(!wasContainerError){
				//lets start
				this.startDockerizedHSD();
			}
		})
	}
	restartDockerContainer(doRestart){
		const _this = this;
		let containerD = spawn('docker',['exec','-i','earthlabHSD','sh','-c','"./stop.sh"'],{shell:true});
		console.log('stop docker is called then')
		containerD.on('close',d=>{
			//console.log('finished docker close cmd',d.toString('utf8'));
			
		});
		containerD.stderr.on('data',d=>{
			console.log('docker close error??',d.toString('utf8'));
			if(d.toString('utf8').indexOf('No such container') >= 0){
				//just initializing then
				console.log('starting container')
				_this.checkDockerSupport(true);
			}
		})
		containerD.stdout.on('data',d=>{
			//
			if(doRestart){
				console.log('docker close data',d.toString('utf8'))
				console.log('should do docker stopping process')
				setTimeout(function(){
					_this.startDockerizedHSD();
				},1000);
			}
		})
		
	}
	nukeDockerContainer(){
		const _this = this;
		console.log('nuke docker container was called');
		let containerD = spawn('docker',['stop','earthlabHSD','&&','docker','rm','earthlabHSD','&&','docker','image','rm','earthlab'],{shell:true});
		containerD.on('close',d=>{
			console.log('removed docker container, now make it again')
			_this.checkDockerSupport(true);
		})
		containerD.stdout.on('data',d=>{
			console.log('nuke docker continer msg',d.toString('utf8'))
		})
		containerD.stderr.on('data',d=>{
			console.log('cant nuke docker continer',d.toString('utf8'))
		})
	}
	animateLogo(){
		window.requestAnimationFrame(()=>{
			if(this.shouldRenderLogo){
				this.animateLogo();
			}

		});
		//this.controls.update();
		this.renderer.render(this.scene,this.camera);
	}
	initLogo(){
		this.shouldRenderLogo = true;
		this.scene = new THREE.Scene();
		this.scene.background =  new THREE.Color(0xeeeeee)
		this.timeGroup = new THREE.Object3D();
		this.scene.add(this.timeGroup);
		this.highlightLinesGroup = new THREE.Object3D();
		this.timeGroup.add(this.highlightLinesGroup);
		this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100000 );
		//this.camera.position.z = -100;
		//this.controls = new THREE.TrackballControls(this.camera,$('#introLogo')[0]);
		this.renderer = new THREE.WebGLRenderer({antialias:true});
		this.clock = new THREE.Clock();
		this.camera.position.x = -window.innerWidth * 2;
		//this.controls.target = new THREE.Vector3(0,0,0)
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		//this.controls.target0 = this.controls.target.clone();
		//this.controls.update();
		this.toggle = 0;
		this.renderer.setSize( Math.floor(window.innerWidth-1), Math.floor(window.innerHeight-1) );
		this.$el = $('#introLogo');
		$('#introLogo').append( this.renderer.domElement );
		this.animateLogo();
		var geometry = new THREE.Geometry();//new createGeom(complex)
		//var bufferGeometry = new THREE.BufferGeometry();
		geometry.dynamic = true;
		for(var i = 0;i<577;i++){
			var f0 = i *3 +0;
			var f1 = i*3 + 1;
			var f2 = i*3 + 2;
			var face = new THREE.Face3(f0,f1,f2)
			geometry.faces.push(face);
		}
		var bufferGeometry;
		console.log('geo isset logo',bufferGeometry)
		var _this = this;
		
		$.getJSON('./glsl/handshake.json',function(d){
			console.log('handshake attrs back',d);
			
			var directions = new Float32Array(d.direction.value.length*3);
			var centroids = new Float32Array(d.centroid.value.length*3);
			var vertices = d.vertices;

			d.direction.value.map(function(v,i){
				directions[i*3+0] = v.x;
				directions[i*3+1] = v.y;
				directions[i*3+2] = v.z;
				geometry.vertices.push(new THREE.Vector3(vertices[i*3+0],vertices[i*3+1],vertices[i*3+2]))
			});
			d.centroid.value.map(function(c,i){
				centroids[i*3+0] = c.x;
				centroids[i*3+1] = c.y;
				centroids[i*3+2] = c.z;
			})

				//console.log('three geometry isset',geometry);
			//console.log('centroids',centroids,directions);
			bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
			bufferGeometry.addAttribute( 'direction', new THREE.BufferAttribute( directions, 3 ) );
			bufferGeometry.addAttribute( 'centroid', new THREE.BufferAttribute( centroids, 3 ) );
			// our shader 
			
			const material = new THREE.ShaderMaterial({
				vertexShader: document.getElementById('logoVertexShader').textContent,
				fragmentShader: document.getElementById('logoFragmentShader').textContent,
				wireframe: false,
				transparent: true,
				opacity:0.5,
				color:new THREE.Color(0xffffff),
				side:THREE.DoubleSide,
				//attributes: bufferGeometry,
				uniforms: {
				  opacity: { type: 'f', value: 1 },
				  scale: { type: 'f', value: 0 },
				  animate: { type: 'f', value: 0 
				}			}
			})
			bufferGeometry.computeBoundingSphere();
			const mesh = new THREE.Mesh(bufferGeometry, material)
			mesh.rotation.setFromVector3(new THREE.Vector3(0,-Math.PI/2,0))
			_this.scene.add(mesh);
			setTimeout(function(){
				addLogoTransition(mesh);
			},100)
			
			function addLogoTransition(mesh){
				var i = 0;
				var si = setInterval(function(){
					if(i >= 1.0){
						i = 0;
						mesh.material.uniforms.animate.value = 1.0;
						mesh.material.uniforms.scale.value = 1.0;

						clearInterval(si);
						setTimeout(function(){
							removeLogo(mesh);
						},500)
						return false;
					}
					i+= 0.04;
					mesh.material.uniforms.animate.value = i;
					mesh.material.uniforms.scale.value = i;
					mesh.position.set(_this.camera.position.x+2.15,_this.camera.position.y + 0.1,_this.camera.position.z);
					//mesh.lookAt(_this.camera.position);
				},21)	
			}
			
			_this.logoMesh = mesh;
			//console.log('logo mesh',mesh)
		})
		function removeLogo(mesh){
			var i = 0;
			mesh.material.wireframe = true;
			//$('#nameList').addClass('showing');

			var si2 = setInterval(function(){
				if(i >= 1.0){
					mesh.material.uniforms.animate.value = 1.0 - i;
					mesh.material.uniforms.scale.value = 1.0 - i;

					clearInterval(si2);
					_this.cameraUnlocked = true;
					_this.shouldRenderLogo = false;
					$('#introLogo').addClass('hidden');
					/*$('#nameList li').eq(1).trigger('mouseenter');
					$('#instructions').fadeIn();
					$('#modes').fadeIn();
					setTimeout(function(){
						$('#nameList li').eq(1).trigger('mouseenter');
					},250)*/
					//ok hide logo and stop rendering three here
					return false;
				}
				i += 0.03;
				
				mesh.material.uniforms.animate.value = 1.0-i;
				mesh.material.uniforms.scale.value = 1.0-i;
				mesh.position.set(_this.camera.position.x+2.15,_this.camera.position.y + 0.1,_this.camera.position.z);
				//mesh.lookAt(_this.camera.position);
			},21)
		}
	}
}
