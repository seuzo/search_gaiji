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
    2012-05-14 0.3.1 合字とユニコード文字の違いを文字数差で解消。Text.ligaturesはなぜかいつもtrue。
    2012-05-14 0.3.2  @JunTajimaさんの合字リストを取り込んだ
    
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
var CID_UNI_Ligature = [
    [12111, "‼", "203C", "! ! "],
    [16278, "⁇", "2047", "? ?"],
    [16279, "⁈", "2048", "? !"],
    [11855, "℀", "2100", "ａ／ｃ"],
    [11859, "℅", "2105", "ｃ／ｏ"],
    [8055, "℡", "2121", "Tel"],
    [8307, "℻", "213B", "FAX"],
    [12098, "♨", "2668", "温泉"],
    [8308, "〄", "3004", "JIS"],
    [16194, "〼", "303C", "ます"],
    [12181, "ゟ", "309F", "より"],
    [16195, "ヿ", "30FF", "コト"],
    [8048, "㌀", "3300", "アパート"],
    [8350, "㌀", "3300", "アパート"],
    [11874, "㌁", "3301", "アルファ"],
    [11958, "㌁", "3301", "アルファ"],
    [11875, "㌂", "3302", "アンペア"],
    [11959, "㌂", "3302", "アンペア"],
    [8042, "㌃", "3303", "アール"],
    [8338, "㌃", "3303", "アール"],
    [11876, "㌄", "3304", "イニング"],
    [11960, "㌄", "3304", "イニング"],
    [8183, "㌅", "3305", "インチ"],
    [8333, "㌅", "3305", "インチ"],
    [11877, "㌆", "3306", "ウォン"],
    [11961, "㌆", "3306", "ウォン"],
    [11881, "㌇", "3307", "エスクード"],
    [11965, "㌇", "3307", "エスクード"],
    [11879, "㌈", "3308", "エーカー"],
    [11963, "㌈", "3308", "エーカー"],
    [11884, "㌉", "3309", "オンス"],
    [11968, "㌉", "3309", "オンス"],
    [11882, "㌊", "330A", "オーム"],
    [11966, "㌊", "330A", "オーム"],
    [11886, "㌋", "330B", "カイリ"],
    [11970, "㌋", "330B", "カイリ"],
    [11888, "㌌", "330C", "カラット"],
    [11972, "㌌", "330C", "カラット"],
    [7595, "㌍", "330D", "カロリー"],
    [7950, "㌍", "330D", "カロリー"],
    [11889, "㌎", "330E", "ガロン"],
    [11973, "㌎", "330E", "ガロン"],
    [11890, "㌏", "330F", "ガンマ"],
    [11974, "㌏", "330F", "ガンマ"],
    [11891, "㌐", "3310", "ギガ"],
    [11975, "㌐", "3310", "ギガ"],
    [11892, "㌑", "3311", "ギニー"],
    [11976, "㌑", "3311", "ギニー"],
    [11893, "㌒", "3312", "キュリー"],
    [11977, "㌒", "3312", "キュリー"],
    [11894, "㌓", "3313", "ギルダー"],
    [11978, "㌓", "3313", "ギルダー"],
    [7586, "㌔", "3314", "キロ"],
    [7941, "㌔", "3314", "キロ"],
    [8041, "㌕", "3315", "キログラム"],
    [8340, "㌕", "3315", "キログラム"],
    [8039, "㌖", "3316", "キロメートル"],
    [8330, "㌖", "3316", "キロメートル"],
    [11896, "㌗", "3317", "キロワット"],
    [11980, "㌗", "3317", "キロワット"],
    [8040, "㌘", "3318", "グラム"],
    [8339, "㌘", "3318", "グラム"],
    [11898, "㌙", "3319", "グラムトン"],
    [11982, "㌙", "3319", "グラムトン"],
    [11900, "㌚", "331A", "クルゼイロ"],
    [11984, "㌚", "331A", "クルゼイロ"],
    [11901, "㌛", "331B", "クローネ"],
    [11985, "㌛", "331B", "クローネ"],
    [11902, "㌜", "331C", "ケース"],
    [11986, "㌜", "331C", "ケース"],
    [11903, "㌝", "331D", "コルナ"],
    [11987, "㌝", "331D", "コルナ"],
    [8051, "㌞", "331E", "コーポ"],
    [8353, "㌞", "331E", "コーポ"],
    [11904, "㌟", "331F", "サイクル"],
    [11988, "㌟", "331F", "サイクル"],
    [11905, "㌠", "3320", "サンチーム"],
    [11989, "㌠", "3320", "サンチーム"],
    [11906, "㌡", "3321", "シリング"],
    [11990, "㌡", "3321", "シリング"],
    [8038, "㌢", "3322", "センチ"],
    [8329, "㌢", "3322", "センチ"],
    [8043, "㌣", "3323", "セント"],
    [8348, "㌣", "3323", "セント"],
    [11907, "㌤", "3324", "ダース"],
    [11991, "㌤", "3324", "ダース"],
    [11909, "㌥", "3325", "デシ"],
    [11993, "㌥", "3325", "デシ"],
    [7596, "㌦", "3326", "ドル"],
    [7951, "㌦", "3326", "ドル"],
    [7590, "㌧", "3327", "トン"],
    [7945, "㌧", "3327", "トン"],
    [11912, "㌨", "3328", "ナノ"],
    [11996, "㌨", "3328", "ナノ"],
    [11913, "㌩", "3329", "ノット"],
    [11997, "㌩", "3329", "ノット"],
    [8052, "㌪", "332A", "ハイツ"],
    [8356, "㌪", "332A", "ハイツ"],
    [7598, "㌫", "332B", "パーセント"],
    [7953, "㌫", "332B", "パーセント"],
    [11915, "㌭", "332D", "バーレル"],
    [11999, "㌭", "332D", "バーレル"],
    [11918, "㌮", "332E", "ピアストル"],
    [12002, "㌮", "332E", "ピアストル"],
    [11919, "㌯", "332F", "ピクル"],
    [12003, "㌯", "332F", "ピクル"],
    [11920, "㌰", "3330", "ピコ"],
    [12004, "㌰", "3330", "ピコ"],
    [8049, "㌱", "3331", "ビル"],
    [8358, "㌱", "3331", "ビル"],
    [11921, "㌲", "3332", "ファラッド"],
    [12005, "㌲", "3332", "ファラッド"],
    [8327, "㌳", "3333", "フィート"],
    [8334, "㌳", "3333", "フィート"],
    [11924, "㌴", "3334", "ブッシェル"],
    [12008, "㌴", "3334", "ブッシェル"],
    [11925, "㌵", "3335", "フラン"],
    [12009, "㌵", "3335", "フラン"],
    [7592, "㌶", "3336", "ヘクタール"],
    [7947, "㌶", "3336", "ヘクタール"],
    [11930, "㌷", "3337", "ペソ"],
    [12014, "㌷", "3337", "ペソ"],
    [11932, "㌸", "3338", "ペニヒ"],
    [12016, "㌸", "3338", "ペニヒ"],
    [8046, "㌹", "3339", "ヘルツ"],
    [8343, "㌹", "3339", "ヘルツ"],
    [11933, "㌺", "333A", "ペンス"],
    [12017, "㌺", "333A", "ペンス"],
    [8047, "㌻", "333B", "ページ"],
    [8349, "㌻", "333B", "ページ"],
    [11926, "㌼", "333C", "ベータ"],
    [12010, "㌼", "333C", "ベータ"],
    [11934, "㌽", "333D", "ポイント"],
    [12018, "㌽", "333D", "ポイント"],
    [11936, "㌾", "333E", "ボルト"],
    [12020, "㌾", "333E", "ボルト"],
    [11937, "㌿", "333F", "ホン"],
    [12021, "㌿", "333F", "ホン"],
    [11938, "㍀", "3340", "ポンド"],
    [12022, "㍀", "3340", "ポンド"],
    [11935, "㍁", "3341", "ホール"],
    [12019, "㍁", "3341", "ホール"],
    [8045, "㍂", "3342", "ホーン"],
    [8347, "㍂", "3342", "ホーン"],
    [11939, "㍃", "3343", "マイクロ"],
    [12023, "㍃", "3343", "マイクロ"],
    [11940, "㍄", "3344", "マイル"],
    [12024, "㍄", "3344", "マイル"],
    [11941, "㍅", "3345", "マッハ"],
    [12025, "㍅", "3345", "マッハ"],
    [11942, "㍆", "3346", "マルク"],
    [12026, "㍆", "3346", "マルク"],
    [8050, "㍇", "3347", "マンション"],
    [8357, "㍇", "3347", "マンション"],
    [11943, "㍈", "3348", "ミクロン"],
    [12027, "㍈", "3348", "ミクロン"],
    [7585, "㍉", "3349", "ミリ"],
    [7940, "㍉", "3349", "ミリ"],
    [7599, "㍊", "334A", "ミリバール"],
    [7954, "㍊", "334A", "ミリバール"],
    [11944, "㍋", "334B", "メガ"],
    [12028, "㍋", "334B", "メガ"],
    [11945, "㍌", "334C", "メガトン"],
    [12029, "㍌", "334C", "メガトン"],
    [7588, "㍍", "334D", "メートル"],
    [7943, "㍍", "334D", "メートル"],
    [8328, "㍎", "334E", "ヤード"],
    [8337, "㍎", "334E", "ヤード"],
    [11946, "㍏", "334F", "ヤール"],
    [12030, "㍏", "334F", "ヤール"],
    [11947, "㍐", "3350", "ユアン"],
    [12031, "㍐", "3350", "ユアン"],
    [7593, "㍑", "3351", "リットル"],
    [7948, "㍑", "3351", "リットル"],
    [11950, "㍒", "3352", "リラ"],
    [12034, "㍒", "3352", "リラ"],
    [11954, "㍓", "3353", "ルピー"],
    [12038, "㍓", "3353", "ルピー"],
    [11951, "㍔", "3354", "ルーブル"],
    [12035, "㍔", "3354", "ルーブル"],
    [11955, "㍕", "3355", "レム"],
    [12039, "㍕", "3355", "レム"],
    [11956, "㍖", "3356", "レントゲン"],
    [12040, "㍖", "3356", "レントゲン"],
    [8044, "㍗", "3357", "ワット"],
    [8344, "㍗", "3357", "ワット"],
    [11861, "㍱", "3371", "hPa"],
    [8323, "㍻", "337B", "平成"],
    [7623, "㍼", "337C", "昭和"],
    [7622, "㍽", "337D", "大正"],
    [7621, "㍾", "337E", "明治"],
    [8054, "㍿", "337F", "株式会社"],
    [8324, "㍿", "337F", "株式会社"],
    [8031, "㎅", "3385", "KB"],
    [8032, "㎆", "3386", "MB"],
    [8033, "㎇", "3387", "GB"],
    [8192, "㎈", "3388", "cal"],
    [8193, "㎉", "3389", "kcal"],
    [11864, "㎍", "338D", "µg"],
    [7604, "㎎", "338E", "mg"],
    [7605, "㎏", "338F", "kg"],
    [8035, "㎐", "3390", "Hz"],
    [8037, "㎖", "3396", "ml"],
    [8024, "㎗", "3397", "dl"],
    [8026, "㎘", "3398", "kl"],
    [11865, "㎛", "339B", "µm"],
    [7601, "㎜", "339C", "mm"],
    [7602, "㎝", "339D", "cm"],
    [7603, "㎞", "339E", "km"],
    [8186, "㎟", "339F", "mm2"],
    [8020, "㎠", "33A0", "cm2"],
    [7607, "㎡", "33A1", "m2"],
    [8021, "㎢", "33A2", "km2"],
    [8187, "㎣", "33A3", "mm3"],
    [8022, "㎤", "33A4", "cm3"],
    [8023, "㎥", "33A5", "m3"],
    [8188, "㎦", "33A6", "km3"],
    [8030, "㎰", "33B0", "ps"],
    [8029, "㎱", "33B1", "ns"],
    [8028, "㎲", "33B2", "µs"],
    [8027, "㎳", "33B3", "ms"],
    [11856, "㏂", "33C2", "am"],
    [7606, "㏄", "33C4", "cc"],
    [8194, "㏈", "33C8", "dB"],
    [8034, "㏋", "33CB", "HP"],
    [8182, "㏌", "33CC", "in"],
    [7611, "㏍", "33CD", "KK"],
    [8036, "㏔", "33D4", "mb"],
    [11869, "㏗", "33D7", "pH"],
    [11870, "㏘", "33D8", "pm"],
    [11851, "㏚", "33DA", "PR"],
    [9421, "ǽ", "01FD", "æ ́"],
    [12937, "ǽ", "01FD", "æ ́"],
    [9420, "ὰ", "1F70", "ɑ ̀"],
    [12936, "ὰ", "1F70", "ɑ ̀"],
    [9419, "ά", "1F71", "ɑ ́"],
    [12935, "ά", "1F71", "ɑ ́"],
    [9434, "ὲ", "1F72", "ɛ ̀"],
    [12950, "ὲ", "1F72", "ɛ ̀"],
    [9433, "έ", "1F73", "ɛ ́"],
    [12949, "έ", "1F73", "ɛ ́"]
];

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



