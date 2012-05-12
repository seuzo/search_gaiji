/*
    search_gaiji.jsx
    リストに書かれたCID文字を検索してXMLタグ（と属性）を付加します。
    ex.)
    <gaiji font="A-OTF リュウミン Pro" fstyle="R-KL" size="9" kind="Variant" cid="8705">髙</gaiji>
    
    2012-05-13  0.1 プロトタイプ。まともに動くとは思えない。
    
    Todo:
    ・CIDのリスト
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

////////////////////////////////////////////設定：CIDリスト
var CID_list = {};
CID_list["OnlyCID"] = [10555, 10556, 10557, 10558];//CID/GID番号のみしか割り当てられていない文字
CID_list["Ligature"] = [8037, 8054];//合字
CID_list["SurrogatePairs"] = [13953];//サロゲートペア
CID_list["Variant"] = [8705, 13706];//Shift_JISで表現できない異体字
CID_list["Unicode"] = [885];//Shift_JISに割り当てがなく、UNICODEのみで使える文字




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
    my_txt_element.xmlAttributes.add("size", my_txt.pointSize.toString());
    my_txt_element.xmlAttributes.add("kind", cid_kind.toString());
    my_txt_element.xmlAttributes.add("cid", cid_no.toString());
   
   return 1;
}



////////////////////////////////////////////以下メイン処理
var i, ii, iii, j, tmp_find, match_obj_list;//ループが多いので最初に変数の宣言してみる。気持ちの問題。
var error_count = 0;//エラーのカウンタ（10回エラーしたら強制終了）
var match_obj_count = 0;//
if (app.documents.length === 0) {my_error("ドキュメントが開かれていません")}
var my_doc = app.documents[0];
var my_fonts = my_doc.fonts;

for ( i = 0; i < my_fonts.length; i++) {//ドキュメント使用フォントのループ
    if (my_fonts[i].writingScript !== 1) {continue;}//日本語フォント以外は無視する
    for ( ii in CID_list){//CID_listの種類ループ
        if (typeof CID_list[ii] === 'function' ) {continue;}//教科書通りの作法
        for ( iii = 0; iii < CID_list[ii].length; iii++){//それぞれのCID番号のループ
            match_obj_list = [];
            try {
                tmp_find = {appliedFont:my_fonts[i].fontFamily, fontStyle:my_fonts[i].fontStyleName, glyphID:CID_list[ii][iii]}
                match_obj_list = my_FindChange_glyph(my_doc, tmp_find, null, true);
            } catch (e) {
                alert(e + "\r" + my_fonts[i].name + "\r" + ii + " : " + CID_list[ii][iii]);
                if (error_count > 9){my_error("エラーが10回以上カウントされたので、強制終了します")}//リストが長いので延々とエラーダイアログを見るかもしれない予防
                error_count++;
            }
            for (j = 0; j < match_obj_list.length; j++) {//マッチしたオブジェクトのループ
                //alert(match_obj_list[j].contents + "\r" + my_fonts[i].name + "\r" + ii + " : " + CID_list[ii][iii]);
                match_obj_count += add_xmlElements(my_doc, match_obj_list[j], "gaiji", ii, CID_list[ii][iii]);
                //match_obj_list[j].select();
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



