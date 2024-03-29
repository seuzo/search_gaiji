﻿/*
    search_gaiji.jsx
    リストに書かれたCID文字を検索してXMLタグ（と属性）を付加します。
    ex.)
    <gaiji font="A-OTF リュウミン Pro" fstyle="R-KL" size="9" kind="Variant" cid="8705">髙</gaiji>
    
    ●see also
    https://github.com/seuzo/search_gaiji
    http://densyodamasii.com/印刷データ→電子書籍で外字化が必要な文字のま/
    http://www.pubridge.jp/info/20120515/
    
    ●history
    2012-05-13 0.1 プロトタイプ。まともに動くとは思えない。
    2012-05-14 0.1.1 sizeの単位をポイント換算で統一した。
    2012-05-14 0.2 正規化リストを用意した。CID番号を２つ与えて置換。
    2012-05-14 0.3 ユニコードのある合字はその文字に置き換えた（開かないようにした）
    2012-05-14 0.3.1 合字とユニコード文字の違いを文字数差で解消。Text.ligaturesはなぜかいつもtrue。→ （v0.5）Unicode文字そのものも置き換えになる。
    2012-05-14 0.3.2  @JunTajimaさんの合字リストを取り込んだ
    2012-05-15 0.4 テーブルとプログラムの分離。「table.json」テーブル本体、「table_index.json」フォント別インデックス。
    2012-05-17 0.5 データ構造の変更。「CID_UNI_Ligature」と「CID_Normalization」を統合して「PRE_Normalization」（タグ処理前置換テーブル）にした。タグ挿入後に実行する「POST_Normalization」（タグ処理後置換テーブル）を入れた。
    
    ●Todo:
    ・CIDのリスト → ユーザーが整備 → 回収・公開・廻流がなければこのプログラムは死ぬ。
    ・ルビテスト → やらなきゃいけないんだろうけど、度胸ががない。意味がよくわかっていないかも。
    ・メインの処理をUndoModes.FAST_ENTIRE_SCRIPT化→変更は少ないからあまり効果ない→たぶんやらない
    ・SING→見て見ないフリ→決定！　もうすぐTodoからも消えます。歴史上、なかったことに！！！
    ・まだやろうとしていることの本質がわかっていない感じする。→ このプログラムはポリシーじゃない。ユーザーが任意のCIDを自由にマークするため。→ ユーザーって誰よ？ →満点ない。65点の人がスキ！
        
*/

//InDesign用スクリプト
#target "InDesign"


////////////////////////////////////////////エラー処理 
function my_error(mess) { 
  if (arguments.length > 0) { alert(mess); }
  exit();
}

////////////////////////////////////////////カレントスクリプトのフルパスを得る 
function get_my_script_path() {
	try {
		return  app.activeScript;
	} catch (myError) {
		return File (myError.fileName);
	}
}

////////////////////////////////////////////ファイルの内容を読み込んで返す 
function read_file(my_read_file_path) {
	var my_file_obj = new File(my_read_file_path);
	if (!(my_file_obj.exists)) {myerror("ファイルがありません\n" + my_read_file_path)};
	if(my_file_obj.open("r")) {
		var tmp_str = my_file_obj.read();
		my_file_obj.close();
	} else {
		myerror("ファイルが開けません\n" + my_read_file_path);
	}
	return tmp_str;
}

////////////////////////////////////////////JSONの読み出し
function read_json(file_name) {
    var my_activescript_path = get_my_script_path();//このスクリプトのフルパス
    var my_activescript_folder = File(my_activescript_path).parent;//カレントディレクトリ
    var my_json_path = my_activescript_folder + "/" + file_name;
    var my_json = read_file(my_json_path);
    return eval('(' + my_json + ')');
}

////////////////////////////////////////////字形検索置換
/*
my_range	検索置換の範囲
my_find	検索オブジェクト ex.) {appliedFont:app.documents[0].fonts[1], glyphID:123}
my_change	置換オブジェクト ex.)  {appliedFont:app.documents[0].fonts[0], glyphID:123}
reverse_order   trueなら反転モード

my_changeが渡されない時は検索のみ、マッチしたオブジェクトを返す。
my_changeが渡されると置換が実行されて、返値はなし。
*/
function my_FindChange_glyph(my_range, my_find, my_change, reverse_order) {
    //検索の初期化
    app.findGlyphPreferences = NothingEnum.nothing;
    app.changeGlyphPreferences = NothingEnum.nothing;
    //検索オプション
    app.findChangeGlyphOptions.includeLockedLayersForFind = false;//ロックされたレイヤーをふくめるかどうか
    app.findChangeGlyphOptions.includeLockedStoriesForFind = false;//ロックされたストーリーを含めるかどうか
    app.findChangeGlyphOptions.includeHiddenLayers = false;//非表示レイヤーを含めるかどうか
    app.findChangeGlyphOptions.includeMasterPages = false;//マスターページを含めるかどうか
    app.findChangeGlyphOptions.includeFootnotes = false;//脚注を含めるかどうか

    app.findGlyphPreferences.properties = my_find;//検索の設定
    if (my_change == null) {
        return my_range.findGlyph(reverse_order);//検索のみの場合：マッチしたオブジェクトを返す
    } else {
        app.changeGlyphPreferences.properties = my_change;//置換の設定
        my_range.changeGlyph(reverse_order);//検索と置換の実行
    }
}

////////////////////////////////////////////characterオブジェクトの大きさをポイントサイズで得る
//UnitValue.as()がQで使えない（バグ）ので、一時的に単位を変更する
function get_pointsize_ofChar(char_obj) {
    var my_doc = app.documents[0];
    var org_unit = my_doc.viewPreferences.textSizeMeasurementUnits;//オリジナルを退避
    if (org_unit === MeasurementUnits.POINTS) {return char_obj.pointSize}
    my_doc.viewPreferences.textSizeMeasurementUnits = MeasurementUnits.POINTS;
    var my_size = char_obj.pointSize;
    my_doc.viewPreferences.textSizeMeasurementUnits = org_unit;//オリジナルに復帰
    return my_size;
}

////////////////////////////////////////////テキストオブジェクトにXMLエレメントを追加
function add_xmlElements(my_doc, my_txt, tag_name, cid_kind, cid_no) {
    var my_story = my_txt.parentStory;//親ストーリ
    var my_root = my_doc.xmlElements[0];//Root要素
    if (my_txt.associatedXMLElements[0].markupTag.name === tag_name) {return 0} //すでにtag_nameでタグづけされていれば何もしない
   
    //親ストーリーのエレメントについて
    var my_story_element = my_story.associatedXMLElement;
    if (my_story_element === null) {//親ストーリーがタグづけされていなかった
    	var my_story_element = my_root.xmlElements.add("story");
    	my_story_element.markup(my_story);
    }
    
    //my_txtをエレメントを追加
    var my_txt_element = my_story_element.xmlElements.add(tag_name);
    my_txt_element.markup(my_txt);
    
    //属性の追加
    my_txt_element.xmlAttributes.add("font", my_txt.appliedFont.fontFamily);
    my_txt_element.xmlAttributes.add("fstyle", my_txt.appliedFont.fontStyleName);
    my_txt_element.xmlAttributes.add("size", get_pointsize_ofChar(my_txt).toString());
    my_txt_element.xmlAttributes.add("kind", cid_kind.toString());
    my_txt_element.xmlAttributes.add("cid", cid_no.toString());
   
   return 1;
}



////////////////////////////////////////////以下メイン処理
var PRE_Normalization;//任意のCID番号を任意の文字（列）に置き換える。CID_listでの処理前に行われる置換。例えば、Unicode番号を持つ合字のリストをテキストに落とし込んだ時に開かないようにする。	[検索CID,置換文字（列）,３項目目以降のフィールドはメモとして使える]
var CID_list; //外字マーキングリスト：種類別のオブジェクト：それぞれの種類はXMLタグの属性値として使われます。
var POST_Normalization; //任意のCID番号を任意の文字（列）に置き換える。CID_listでの処理後に行われる置換。例えば、ビブロスフォントやピクトグラムなど、Unicodeと字形が乖離しているフォントなどの後処理を想定。ex.）「<gaiji 諸属性>A</gaiji>」を「<gaiji 諸属性>（アイロン弱）</gaiji>」みたいな感じ。	[検索CID,置換文字（列）,３項目目以降のフィールドはメモとして使える]
var i, ii, iii, iiii, x, y, m, n, j, tmp_font_styleName, tmp_font_familyName, tmp_index, tmp_find, match_obj_list;//ループが多いので最初に変数の宣言してみる。気持ちの問題。
var error_count = 0;//エラーのカウンタ（10回エラーしたら強制終了）
var match_obj_count = 0;//ご報告ためのカウンタ

//JSONの読み出し
var my_json = read_json("table.json"); //テーブル本体
var my_json_index = read_json("table_index.json"); //特定のフォントで何番目のテーブルを使うのかインデックス

if (app.documents.length === 0) {my_error("ドキュメントが開かれていません")}
var my_doc = app.documents[0];
var my_fonts = my_doc.fonts;

//ドキュメント使用フォントのループ
for ( i = 0; i < my_fonts.length; i++) {
    if (my_fonts[i].writingScript !== 1) {continue;}//日本語フォント以外は無視する
    tmp_font_familyName = my_fonts[i].fontFamily;//フォントファミリ名
    tmp_font_styleName = my_fonts[i].fontStyleName;//フォントスタイル名
    
    //フォントごとにテーブルを読み替え
    tmp_index = my_json_index[tmp_font_familyName];//カレントフォントが使用するmy_jsonテーブルのインデックス番号
    if (tmp_index === undefined) {tmp_index = 0;}//フォントファミリがマッチしなければ、汎用的に使える0番テーブル
    PRE_Normalization = my_json[tmp_index]["PRE_Normalization"];
    CID_list = my_json[tmp_index]["CID_list"];
    POST_Normalization = my_json[tmp_index]["POST_Normalization"];


    //任意のCID番号検索してUnicode文字列に置換するループ（タグ処理前）
    for (x = 0; x < PRE_Normalization.length; x++) {
        match_obj_list = [];
        try {
            tmp_find = {appliedFont:tmp_font_familyName, fontStyle:tmp_font_styleName, glyphID:PRE_Normalization[x][0]}
            match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
        } catch (e) {
            alert(e + "\r" + my_fonts[i].name + "\rPRE_Normalization: " + PRE_Normalization[x][0] + "\rUnicode: " + PRE_Normalization[x][1]);//★現在はデバック用あとでトル
            if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
            error_count++;
        }
        for (y = 0; y < match_obj_list.length; y++) {
            match_obj_list[y].contents = PRE_Normalization[x][1];
        }
    }//PRE_Normalizationのループ
    
    //XMLタグマーキングのためのループ
    for ( ii in CID_list){//CID_listの種類ループ
        if (typeof CID_list[ii] === 'function' ) {continue;}//教科書通りの作法
        for ( iii = 0; iii < CID_list[ii].length; iii++){//それぞれのCID番号のループ
            match_obj_list = [];
            try {
                tmp_find = {appliedFont:tmp_font_familyName, fontStyle:tmp_font_styleName, glyphID:CID_list[ii][iii]}
                match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
            } catch (e) {
                alert(e + "\r" + my_fonts[i].name + "\rCID_list[" + ii + "] : " + CID_list[ii][iii]);//★現在はデバック用あとでトル
                if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
                error_count++;
            }
            for (iiii = 0; iiii < match_obj_list.length; iiii++) {//マッチしたオブジェクトのループ
                //alert(match_obj_list[iiii].contents + "\r" + my_fonts[i].name + "\r" + ii + " : " + CID_list[ii][iii]);
                match_obj_count += add_xmlElements(my_doc, match_obj_list[iiii], "gaiji", ii, CID_list[ii][iii]);
            }
        }
    }//CID_listの種類ループ

    //任意のCID番号検索してUnicode文字列に置換するループ（タグ処理後）
    for (m = 0; m < POST_Normalization.length; m++) {
        match_obj_list = [];
        try {
            tmp_find = {appliedFont:tmp_font_familyName, fontStyle:tmp_font_styleName, glyphID:POST_Normalization[m][0]}
            match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
        } catch (e) {
            alert(e + "\r" + my_fonts[i].name + "\rPOST_Normalization: " + POST_Normalization[m][0]);//★現在はデバック用あとでトル
            if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
            error_count++;
        }
        for (n = 0; n < match_obj_list.length; n++) {
            match_obj_list[n].contents = POST_Normalization[m][1];
        }
    }//POST_Normalization


}//fontsループ

//ご報告
if (match_obj_count === 0 ) {
    alert("タグを追加するべき外字はありませんでした");
} else {
    alert(match_obj_count + "箇所の外字にタグを追加しました");
}
