/* English / 中文. English strings are the keys; T() falls back to English. */
(function () {
  'use strict';
  const I18N = window.I18N = { lang: 'en' };
  I18N.set = l => { I18N.lang = l === 'zh' ? 'zh' : 'en'; };
  window.T = function (s, vars) {
    let out = (I18N.lang === 'zh' && I18N.zh[s]) || s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  };

  I18N.zh = {
    // shell
    'Language': '语言', 'Theme': '主题', 'Mute': '静音', 'Unmute': '取消静音',
    'Play': '牌局', 'History': '历史', 'Players': '玩家', 'Settings': '设置',
    'Tap to skip': '点击跳过', 'Poker night': '扑克之夜', 'Payments': '转账',
    'Everyone is even. No payments needed.': '大家打平，无需转账。',
    'Could not save. Is storage full?': '无法保存，存储空间是否已满？',
    'Cancel': '取消', 'OK': '确定', 'Back': '返回', 'Save': '保存', 'Add': '添加',
    'Remove': '移除', 'Delete': '删除', 'Edit': '编辑', 'Undo': '撤销', 'Discard': '放弃',

    // table
    'House': '庄家', 'chips': '筹码', 'Join': '加入', 'counting…': '清点中…', 'out': '已离场',
    'Late joiner': '中途加入', 'Seat {n}': '{n} 号位', 'Host': '主持人',
    'New player name': '新玩家名字', '{name} is already seated': '{name} 已经入座', 'Add player': '添加玩家', 'Saved players': '已保存的玩家',

    // live game
    'Chips on table': '桌上筹码', 'Elapsed': '已用时间', 'House pile': '抽水池', 'Hands': '手数',
    'Rake': '抽水', 'Record hand': '记录一手', 'End game': '结束牌局',
    'Give each player {n} chips:': '给每位玩家 {n} 筹码：', 'Can’t be made exactly with your colours.': '现有颜色无法凑出这个数。',
    'Confirm {n} buy-ins': '确认 {n} 笔买入',
    'Change colours': '换颜色', 'More': '更多', 'Other': '其他金额', 'At most the {n} chips on the table.': '不能超过桌上的 {n} 筹码。',
    'That’s more than the chip leader has. The most is {n} chips.': '超过了筹码最多者的筹码，最多 {n} 筹码。', 'Buy in {m}': '买入 {m}',
    'How many chips does the chip leader have?': '筹码最多的人有多少筹码？',
    '{name} wants {n} chips. Nobody can buy in for more than the chip leader has.': '{name} 想买 {n} 筹码。买入不能超过筹码最多者。',
    'Give {name} {mix}': '给 {name}：{mix}', 'Colours for {name}': '{name} 的筹码颜色',
    'Everyone buys in {m}': '每人买入 {m}', 'Everyone buys in': '每人买入',
    'The bank doesn’t have enough of some colours for everyone. Check the bank.': '库存中某些颜色不够每人一份，请查看库存。',
    'buy-in': '份买入', 'Buy in': '买入', 'Buy-in amount': '买入数额', 'Chip leader’s stack': '筹码最多者的筹码',



    'Bank': '库存', 'Pieces': '枚数', 'not counted': '未清点', '{a} of {b} left': '剩 {a} / {b}',
    'Buy-ins take chips from the bank and cash-outs put them back. Suggested mixes keep some of every colour for later buy-ins.': '买入从库存取筹码，提前兑现会放回库存。建议的组合会给之后的买入留下每种颜色。',
    'Player': '玩家', 'Buy-ins': '买入次数', 'In': '买入', 'host': '主持', 'most rebuys': '补码最多', 'cashed out': '已兑现', 'Chips bought': '买入筹码',
    'Cashed out {n} chips at {t}': '{t} 兑现 {n} 筹码', 'Undo cash-out': '撤销兑现', 'Custom': '自定义',
    'Buy-in log': '买入记录', 'Undo this buy-in?': '撤销这笔买入？', 'Count chips': '清点筹码', 'Cash out': '提前兑现',
    'Bust (0)': '输光 (0)', 'Rename': '改名', 'Handles': '收款账号', 'Move seat': '换座位', 'Make host': '设为主持人',
    'Buy-in for {name}': '{name} 买入',
    '{n} chips': '{n} 筹码', 'Enter whole chips': '请输入整数筹码', 'Money': '金额', 'Chips': '筹码',
    '{name} is bust?': '{name} 输光了？', 'Counts them as 0 chips and locks them.': '记为 0 筹码并锁定。', 'Bust': '输光',
    'That name is taken by another player.': '这个名字已被其他玩家使用。', 'Payment handles': '收款账号', 'Move {name} to…': '把 {name} 移到…',
    'result': '结果', 'Other chips (loose total)': '其他筹码（直接输入总数）', 'Bought {n} chips': '已买入 {n} 筹码',
    'Save count': '保存清点', 'Fix buy-ins…': '修改买入…',
    'Chips in pot': '底池筹码', 'Add to house pile': '放入抽水池', 'No rake.': '不抽水。', 'Pot is below {n} chips.': '底池少于 {n} 筹码。',
    'Fee rounds down to 0 chips.': '抽水向下取整为 0 筹码。', 'Take out {n} chips': '取出 {n} 筹码',
    '{n} chips can’t be grabbed exactly. Make change from the pot.': '{n} 筹码无法正好取出，请从底池找零。',
    'no rake below {n} chips': '低于 {n} 筹码不抽水', 'pot {n}': '底池 {n}', 'Nothing raked yet.': '还没有抽水。', 'Rake a pot': '抽一次水',
    'Pot (optional)': '底池（可选）', 'Hand #{n}': '第 {n} 手', 'Winner(s)': '赢家', 'select several for a split pot': '平分底池可多选',
    'Save hand': '保存这一手', 'Hand log': '牌局记录', 'Undo the last hand?': '撤销最后一手？', 'Undo last': '撤销上一手',
    'No hands yet. Tap “Record hand”.': '还没有记录。点击“记录一手”。',
    'Showdown': '摊牌', 'Everyone folded': '全部弃牌', 'All-in': '全下',
    'Level {n}': '第 {n} 级', 'Next {a}/{b}': '下一级 {a}/{b}', 'Last level': '最后一级', 'Previous level': '上一级', 'Pause': '暂停', 'Start': '开始',
    'Next level': '下一级', 'Blinds up: {a}/{b}': '盲注升级：{a}/{b}',
    'Nobody has bought in yet.': '还没有人买入。', 'End the game and count chips?': '结束牌局并清点筹码？',
    'You can still fix buy-ins while counting.': '清点时仍可修改买入。', 'Start counting': '开始清点',
    'Editing a past game': '正在编辑历史牌局', 'Count each player’s chips. Tap seats in any order.': '清点每位玩家的筹码，可按任意顺序点击座位。', 'Count each player’s chips. Tap players in any order.': '清点每位玩家的筹码，可按任意顺序点击玩家。', 'Counted': '已清点',
    'Chips handed out': '已发筹码', 'Counted so far': '已清点', '{n} players still counting': '还有 {n} 位玩家在清点', 'Calculate': '计算',
    'Discard your edits?': '放弃修改？', 'The saved game stays as it was.': '已保存的牌局保持不变。', 'Discard edits': '放弃修改', 'Back to game': '返回牌局',
    'Something’s off: {n} chips {what}.': '有问题：{what} {n} 筹码。', 'missing': '少了', 'extra': '多了',
    'Handed out {a} · counted {b} (incl. house {c})': '已发 {a} · 清点 {b}（含抽水 {c}）', 'Recount': '重新清点',
    'Distribute the difference ({n} chips each, roughly)': '平摊差额（每人约 {n} 筹码）',
    'Finish or discard the current game first.': '请先完成或放弃当前牌局。',

    // colour helper
    'Confirm {m}': '确认 {m}', 'Add some chips': '请添加筹码', 'Total {n} chips': '共 {n} 筹码',
    '{n} too many': '多了 {n}', '{n} to go': '还差 {n}',
    'Build by colours: hand out any chips, the total becomes the buy-in.': '按颜色自由组合：发多少筹码，买入就算多少。',
    '{n} chips can’t be made exactly with your colours.': '现有颜色无法正好凑出 {n} 筹码。',
    'Back to the target amount': '回到目标数额', 'Build by colours (free mode)': '按颜色自由组合',
    'Over the chip leader ({n} max)': '超过筹码最多者（最多 {n}）', '{n} left in bank': '库存剩 {n}',
    'Reset to suggested': '恢复建议', 'Change any count; the other colours rebalance.': '改动任意数量，其他颜色会自动重新分配。',
    'The other colours can’t make up the rest. Change another colour.': '其他颜色凑不出剩下的数，请再改一种颜色。',
    'The bank is short of some colours, so this mix ignores the bank counts.': '库存中某些颜色不够，这个组合没有考虑库存。',

    // home, history, players
    'Buy-ins, rake, chip counts and the fewest payments to settle up.': '买入、抽水、清点筹码，用最少的转账结清。',
    'New game': '新牌局', 'Quick start from last game': '沿用上一局快速开始', 'Last game': '上一局', '{n} players': '{n} 位玩家', 'in': '买入',
    'Finished games show up here.': '结束的牌局会显示在这里。', 'All-time podium': '历史总榜', 'Running total': '累计盈亏',
    '{n} games': '{n} 局', 'win rate {p}%': '胜率 {p}%', 'No finished games yet': '还没有完成的牌局', 'Players you seat are saved here.': '入座过的玩家会保存在这里。',
    'Badges': '徽章', 'Games played': '参与局数', 'Lifetime result': '累计盈亏', 'Biggest win': '最大单局赢', 'Biggest loss': '最大单局输',
    'Win rate': '胜率', 'Average per game': '场均', 'Total bought in': '累计买入', 'Hands won': '赢的手数', 'Current streak': '当前连续',
    'wins': '连胜', 'losses': '连败', 'Edit handles': '编辑收款账号', 'Delete {name}?': '删除 {name}？', 'Delete player': '删除玩家',
    'Past games keep the name they were played under.': '历史牌局保留当时的名字。',
    'Hot streak': '手热', 'Cold streak': '手冷', 'All-time leader': '总榜第一', 'Biggest single win': '单局最大赢家', 'Generous donor': '慷慨捐赠者',
    'Regular': '常客', 'Best ROI': '最佳回报率', 'Rebuy king': '补码之王',
    'Hot streak (3+ wins in a row)': '手热（连赢 3 局以上）', 'Cold streak (3+ losses in a row)': '手冷（连输 3 局以上）',
    'Generous donor (biggest single loss)': '慷慨捐赠者（单局输最多）', 'Regular (most games)': '常客（参与局数最多）',
    'Best ROI (3+ games)': '最佳回报率（3 局以上）', 'Rebuy king (most buy-ins per game)': '补码之王（场均买入最多）',

    // settings
    'That file is not a Stack & Settle backup.': '这不是 Stack & Settle 的备份文件。', 'Replace all data with this backup?': '用这个备份替换所有数据？',
    '{g} games, {p} players. Your current data will be overwritten.': '{g} 局，{p} 位玩家。当前数据将被覆盖。',
    'Import': '导入', 'Backup imported': '备份已导入', 'Follow phone': '跟随系统', 'Light': '浅色', 'Dark': '深色', 'Sound': '声音', 'Backup': '备份',
    'All data lives only in this browser on this phone. Export a backup regularly, or before changing phones.': '所有数据只保存在这部手机的浏览器里。请定期导出备份，换手机前也要导出。',
    'Last backup: {d}': '上次备份：{d}', 'never': '从未', 'Backup downloaded': '备份已下载', 'Export': '导出', 'Danger zone': '危险操作',
    'Delete all data?': '删除所有数据？', 'Every game, player and the current game will be erased. This cannot be undone.': '所有牌局、玩家和当前牌局都会被清除，且无法恢复。',
    'Delete everything': '全部删除', 'Are you sure?': '确定吗？', 'Last chance. Consider exporting a backup first.': '最后确认。建议先导出备份。',
    'Yes, delete': '是的，删除', 'All data deleted': '所有数据已删除', 'Delete all data': '删除所有数据',

    // results
    'Game not found.': '找不到这局。', 'Edit game': '编辑牌局', 'Edit this game?': '编辑这一局？',
    'It reopens at the counting stage. Payments marked as paid will reset.': '将回到清点阶段，已标记的转账会重置。',
    'Delete game': '删除牌局', 'Delete this game?': '删除这一局？', 'It is removed from history and lifetime stats.': '它会从历史和累计统计中移除。',
    'Back up your data now (download a JSON file).': '立即备份数据（下载 JSON 文件）。',
    'Results': '结果', 'Stats': '统计', 'Share': '分享', 'Recap image': '战报图片', 'Result': '盈亏',
    '{n} chips were {what} and spread equally (numbers in brackets).': '{what} {n} 筹码，已平均分摊（括号内数字）。',
    '1 chip = {v} · result = chips × chip value − money in': '1 筹码 = {v} · 盈亏 = 筹码 × 单价 − 买入',
    '{n} payments, the fewest possible. Nobody both pays and receives.': '共 {n} 笔转账，已是最少。没有人既付款又收款。',
    '{a} of {b} paid': '已付 {a}/{b}', '{name} pays': '{name} 付款', 'Add e-Transfer / WeChat handle': '添加 e-Transfer / 微信账号',
    'Copied. Paste it in the group chat.': '已复制，粘贴到群聊即可。', 'Could not copy': '复制失败', 'Could not make the image': '无法生成图片',
    'Duration': '时长', 'Total money in': '买入总额', 'Rebuys': '补码次数', 'Biggest winner': '最大赢家', 'Biggest loser': '最大输家',
    'Most rebuys': '补码最多', 'Rake taken': '抽水总额', 'No hands were recorded.': '没有记录任何一手。', 'Hands played': '总手数',
    'Biggest pot': '最大底池', 'Longest win streak': '最长连胜', 'Tags': '标签', 'Chips won': '赢得筹码',

    // setup

    'Simple': '简单', 'Detailed': '详细',
    'A table seats 10 at most.': '一桌最多 10 人。', 'Host fee {p}%': '抽水 {p}%', 'Fixed buy-ins': '固定买入',
    'Chip-leader rule': '筹码上限规则', 'Your chips': '你的筹码', 'My chips': '我的筹码', 'New set': '新套装',
    'Name this set, e.g. Home set': '给这套筹码起个名字，例如：家里那套', 'Chip set name': '筹码套装名称',
    'Saved on this phone as you type, ready for your next game.': '输入时自动保存在本机，下次开局可直接使用。',
    'Basics': '基本', 'More options': '更多选项', 'Also on: {list}': '已开启：{list}',
    'Detailed mode': '详细模式', 'Shows the poker table and records every hand: who won, the pot and a tag. Adds hand stats. When off, the game is a list of players and their buy-ins.': '显示牌桌并记录每一手：赢家、底池和标签，增加逐手统计。关闭时，牌局只是玩家及其买入的列表。',
    'Fixed buy-ins only': '只能固定买入',
    'The host takes a percentage of each pot.': '主持人从每个底池中抽取一定比例。',
    'Raises the blinds on a timer, with a bell at each new level.': '按时升盲，每升一级响铃提醒。',
    'Choose seats': '自选座位', 'When off, players sit side by side in the order you add them.': '关闭时，玩家按添加顺序依次入座。',
    'Who’s the host?': '谁是主持人？', 'Someone not playing': '不上桌的人', 'Add at least two players.': '请至少添加两位玩家。',
    'Pick who’s hosting.': '请选择主持人。', '{name} is seated. Pick them as the host instead.': '{name} 已入座，请直接选他为主持人。',
    'Symbol': '符号', 'Buy-in': '买入', 'Costs': '价格', 'Gets': '得到',
    'Discard this setup?': '放弃这次设置？', 'Start game': '开始牌局',
    'One chip must be a whole number of cents.': '单个筹码的价值必须是整分。',
    'Enter the number of chips as a whole number.': '请输入筹码数（整数）。', 'Enter what those chips are worth, for example 20.': '请输入这些筹码值多少钱，例如 20。',
    'Every buy-in is exactly {chips} chips ({money}). No other amounts.': '每次买入固定为 {chips} 筹码（{money}），不能买其他数额。',
    'Only asked when someone buys in for more than {chips} chips: you enter the chip leader’s stack, and bigger buy-ins are blocked.': '只有买入超过 {chips} 筹码时才会询问：输入筹码最多者的筹码，超过的买入会被阻止。',
    'No buying in for more than the chip leader has': '买入不能超过筹码最多者',

    'A buy-in of {n} chips can’t be made exactly with these colours.': '这些颜色无法正好凑出 {n} 筹码的买入。',
    'The house has {n} chips worth {m}: enough for {k} buy-ins of {b}.': '庄家共有 {n} 枚筹码，价值 {m}，够 {k} 次 {b} 的买入。',
    'Count the chips in your set so the app can split colours fairly and keep some in the bank.': '清点你的筹码数量，应用就能公平分配颜色，并在库存中留出余量。',
    'How many': '数量', 'How many the house has': '庄家有多少枚',
    'Set each colour’s value, in chips or in money, and how many of it the house has.': '设置每种颜色的面值（按筹码或金额），以及庄家有多少枚。', 'Add at least one chip colour.': '请至少添加一种筹码颜色。',
    'Every colour needs a value in whole chips.': '每种颜色都需要整数筹码面值。', 'Enter a fee percentage, for example 2.5.': '请输入抽水比例，例如 2.5。',
    'Minimum pot must be a whole number of chips.': '最低底池必须是整数筹码。', "Enter the host's name.": '请输入主持人名字。',
    'Enter minutes per blind level.': '请输入每级盲注的分钟数。', 'Add at least one blind level.': '请至少添加一个盲注级别。',

    'Enter both values to see the value of one chip.': '输入两个数值即可看到单个筹码的价值。', '1 chip = {v}': '1 筹码 = {v}',
 '1 chip would be {v}. Not a whole number of cents.': '1 筹码将是 {v}，不是整分。',
    'Use {n} chips ({v} each)': '改用 {n} 筹码（每个 {v}）', 'Currency': '货币',
    'Colour': '颜色', 'Value (chips)': '面值（筹码）', 'Value ({s})': '面值（{s}）', 'Add colour': '添加颜色',
    'Percent of pot': '底池比例', 'No rake below (chips)': '低于此数不抽水（筹码）',
    'Host name': '主持人名字',
    'Small blind': '小盲', 'Big blind': '大盲', 'Minutes per level': '每级分钟数', 'Blind levels (small / big)': '盲注级别（小盲 / 大盲）', 'Add level': '添加级别',
    'Host fee (rake)': '主持费（抽水）', 'Blinds timer': '盲注计时器', '{n} seated': '已入座 {n} 人',
    'Seats': '座位数', 'Too many players for {n} seats': '{n} 个座位坐不下这么多玩家', 'Shuffle seats': '随机换座',
    'Tap a player to move them to another seat.': '点击玩家可将其换到其他座位。',
  };
})();
