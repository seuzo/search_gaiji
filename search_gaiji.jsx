/*
    search_gaiji.jsx
    リストに書かれたCID文字を検索してXMLタグ（と属性）を付加します。
    ex.)
    <gaiji font="A-OTF リュウミン Pro" fstyle="R-KL" size="9" kind="Variant" cid="8705">髙</gaiji>
    
    ●see also
    https://github.com/seuzo/search_gaiji
    http://densyodamasii.com/印刷データ→電子書籍で外字化が必要な文字のま/
    
    ●history
    2012-05-13 0.1 プロトタイプ。まともに動くとは思えない。
    2012-05-14 0.1.1 sizeの単位をポイント換算で統一した。
    2012-05-14 0.2 正規化リストを用意した。CID番号を２つ与えて置換。
    2012-05-14 0.3 ユニコードのある合字はその文字に置き換えた（開かないようにした）
    
    ●Todo:
    ・CIDのリスト
    ・ルビテスト
    ・メインの処理をUndoModes.FAST_ENTIRE_SCRIPT化→変更は少ないからあまり効果ないかも
    ・マーキング方法（XMLエレメント＆属性）はこれでよいか？
    ・全体的にフォント置換をして、最適化スピードアップ→置換で字形変わるかも→たぶんボツ
    ・フォント依存について
    　　・フォントの種類によって分岐してフォント依存を解消？　キリない。
   　　 ・自作フォントの対応→個別に拡張できるようにする？　別のマッチングシステムが必要？
    　　・Biblos外字→各フォントとの対応表テーブル必要か？　→ある程度Unicodeで置き換えするか？
    　　・SING→見て見ないフリ
    ・まだやろうとしていることの本質がわかっていない感じする。
    
*/

//InDesign用スクリプト
#target "InDesign"

////////////////////////////////////////////設定：CIDリスト：グルーバル
//Unicode番号を持つ合字のリスト。テキストに落とし込んだ時に開かないようにする。[検索CID,置換文字（列）,３項目目以降のフィールドはメモとして使える]
var CID_UNI_Ligature = [[12098, "♨", "2668"], [8054, "㍿",  "337F"]];//3カラム目のUnicode番号は単なるメモ

//正規化リスト：CID番号の1対1の多重リストで置換する。タグマーキングより前で行われる。[検索CID,置換CID,３項目目以降のフィールドはメモとして使える]
var CID_Normalization = [[4467, 2051], [4462, 2051]];

//外字マーキングリスト：種類別のオブジェクト
var CID_list = {};
    //CID/GID番号のみしか割り当てられていない文字
    CID_list["OnlyCID"] = [10555, 10556, 10557, 10558];
    //合字
    CID_list["Ligature"] = [8037, 8054];
    //サロゲートペア
    CID_list["SurrogatePairs"] = [13953];
    //Shift_JISで表現できない異体字
    CID_list["Variant"] = [8705, 13706];
    //Shift_JISに割り当てがなく、UNICODEのみで使える文字
    CID_list["Unicode"] = [885];



////////////////////////////////////////////エラー処理 
function my_error(mess) { 
  if (arguments.length > 0) { alert(mess); }
  exit();
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
var i, ii, iii, iiii, x, y, n, j, tmp_find, match_obj_list;//ループが多いので最初に変数の宣言してみる。気持ちの問題。
var error_count = 0;//エラーのカウンタ（10回エラーしたら強制終了）
var match_obj_count = 0;//ご報告ためのカウンタ
if (app.documents.length === 0) {my_error("ドキュメントが開かれていません")}
var my_doc = app.documents[0];
var my_fonts = my_doc.fonts;

for ( i = 0; i < my_fonts.length; i++) {//ドキュメント使用フォントのループ
    if (my_fonts[i].writingScript !== 1) {continue;}//日本語フォント以外は無視する
    
    //Unicode番号を持つ合字をCID検索してUnicode文字に置換
    for (x = 0; x < CID_UNI_Ligature.length; x++) {
        match_obj_list = [];
        try {
            tmp_find = {appliedFont:my_fonts[i].fontFamily, fontStyle:my_fonts[i].fontStyleName, glyphID:CID_UNI_Ligature[x][0]}
            match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
        } catch (e) {
            alert(e + "\r" + my_fonts[i].name + "\rCID_UNI_Ligature: " + CID_UNI_Ligature[x][0] + "\rUnicode: " + CID_UNI_Ligature[x][1]);//★現在はデバック用あとでトル
            if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
            error_count++;
        }
        for (y = 0; y < match_obj_list.length; y++) {
            //Text.ligaturesを利用したい場面だけどなぜかいつもtrue。
            if (match_obj_list[y].contents.length > 1) {
                //alert(CID_UNI_Ligature[x][1] + match_obj_list[y].contents.length);
                match_obj_list[y].contents = CID_UNI_Ligature[x][1];
            }
        }
    }
    
    //正規化のためにCID_Normalizationに書かれた置換を実行する
    for (n = 0; n < CID_Normalization.length; n++) {
        match_obj_list = [];
        try {
            tmp_find = {appliedFont:my_fonts[i].fontFamily, fontStyle:my_fonts[i].fontStyleName, glyphID:CID_Normalization[n][0]}
            tmp_change = {appliedFont:my_fonts[i].fontFamily, fontStyle:my_fonts[i].fontStyleName, glyphID:CID_Normalization[n][1]}
            match_obj_list = my_FindChange_glyph(my_doc, tmp_find, tmp_change, true);
        } catch (e) {
            alert(e + "\r" + my_fonts[i].name + "\rCID_Normalization: " + CID_Normalization[n][0]);//★現在はデバック用あとでトル
            if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
            error_count++;
        }
    }
    
    //XMLタグマーキングのためのループ
    for ( ii in CID_list){//CID_listの種類ループ
        if (typeof CID_list[ii] === 'function' ) {continue;}//教科書通りの作法
        for ( iii = 0; iii < CID_list[ii].length; iii++){//それぞれのCID番号のループ
            match_obj_list = [];
            try {
                tmp_find = {appliedFont:my_fonts[i].fontFamily, fontStyle:my_fonts[i].fontStyleName, glyphID:CID_list[ii][iii]}
                match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
            } catch (e) {
                alert(e + "\r" + my_fonts[i].name + "\rCID_list[" + ii + "] : " + CID_list[ii][iii]);//★現在はデバック用あとでトル
                if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
                error_count++;
            }
            for (iiii = 0; iiii < match_obj_list.length; iiii++) {//マッチしたオブジェクトのループ
                //alert(match_obj_list[iiii].contents + "\r" + my_fonts[i].name + "\r" + ii + " : " + CID_list[ii][iii]);
                match_obj_count += add_xmlElements(my_doc, match_obj_list[iiii], "gaiji", ii, CID_list[ii][iii]);
                //match_obj_list[iiii].select();
            }
        }
    }
}

//ご報告
if (match_obj_count === 0 ) {
    alert("タグを追加するべき外字はありませんでした");
} else {
    alert(match_obj_count + "箇所の外字にタグを追加しました");
}



