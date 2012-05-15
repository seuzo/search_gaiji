/*
フォントファミリー名を書き出す。
あとでsort -uで重複はトル

フォントのCMapの種類ってスクリプトでは調べられないものなのかな...
どこを見ればいいのか？？
*/
////////////////////////////////////////////データをファイルに書き込む 。書き込んだファイルオブジェクトを返す
function write_file(my_write_file_path, my_data) {
	var my_file_obj = new File(my_write_file_path);
	my_file_obj.encoding = "UTF-8";//★この行がないとShift-JISで書き出される
	//if (!(my_file_obj.exists)) {myerror("ファイルがありません\n" + my_write_file_path)};
	if(my_file_obj.open("w")) {
		my_file_obj.write(my_data);
		my_file_obj.close();
		return my_file_obj;
	} else {
		my_error("ファイルが開けません\n" + my_write_file_path);
	}
}

var my_file_path = File.saveDialog("保存ファイル名と保存場所を入力してください。\r2〜3分時間がかかります。");

var my_Fonts_ja = new Array();
for (var i = 0; i< app.fonts.length; i++) {
	if (app.fonts[i].writingScript === 1) {
		my_Fonts_ja.push(app.fonts[i].fontFamily);//ファイミリー名
	} else {break}//日本語版のみ、日本語フォントが先にインデックスされているためbreakできる。
}

write_file(my_file_path, my_Fonts_ja.join("\r"));