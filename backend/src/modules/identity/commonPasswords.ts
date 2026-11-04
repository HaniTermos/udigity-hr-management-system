/**
 * Compact offline list of commonly used passwords and password "cores" (passwordPolicy.ts). Data only.
 *
 * Source: the head of the well-known public lists of most common passwords (SecLists
 * `Passwords/Common-Credentials/10k-most-common.txt`, the NCSC/HIBP "top passwords" lists), reduced to the entries
 * and base words that matter for a 12-character minimum: passwordPolicy.ts matches the whole value AND its core
 * (case, leading/trailing digits and symbols, letter substitutions and separators removed), so "summer" here
 * refuses "Summer2026!!", "$ummer-2026" and "summersummer". Plus local words (company and product names).
 * The full 10k file was not fetched (no download in this build); dropping more lowercase entries into this list
 * strengthens the check with no code change.
 */
const LIST = `
123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football monkey
letmein 696969 shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777
121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer harley batman andrew
tigger sunshine iloveyou 2000 charlie robert thomas hockey ranger daniel starwars klaster 112233 george computer
michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie 159753 aaaaaa ginger princess
joshua cheese amanda summer love ashley nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder
taylor matrix mobilemail mom monitor monitoring montana moon moscow welcome welcome1 admin administrator root toor
passw0rd password1 password12 password123 password1234 p4ssword pa55word passwd secret secret123 changeme changeit
default guest login letmein1 qwerty123 qwerty1 qwertyui 1q2w3e4r 1q2w3e4r5t 1q2w3e 1q2w3e4r5t6y zaq12wsx zaq1zaq1
q1w2e3r4 q1w2e3r4t5 asdf asdfasdf asdfghjkl qweasd qweasdzxc qwer1234 abcd1234 abcdef abcdefg abcdefgh aa123456
iloveyou1 princess1 sunshine1 football1 monkey1 shadow1 superman1 master1 dragon1 baseball1 hello hello123 hello1
hellohello whatever trustme letmeinnow fuckyou fuckoff jesus christ god angel angels heaven blessed faith hope
lovely loveme lover loving babygirl baby babe honey sweet sweetie sweetheart cutie flower flowers butterfly rainbow
summer winter spring autumn fall january february march april may june july august september october november
december monday tuesday wednesday thursday friday saturday sunday morning midnight
orange banana apple cherry lemon mango peach strawberry chocolate cookie cookies pizza coffee
tiger lion eagle falcon dolphin panther cowboy cowboys yankee rangers lakers bulls eagles steelers packers giants
arsenal liverpool chelsea1 manchester barcelona madrid realmadrid juventus milan united city
mercedes ferrari porsche corvette camaro mustang1 harley1 yamaha honda toyota nissan bmw audi
michael1 jordan23 jordan1 jennifer1 jessica1 ashley1 nicole1 daniel1 andrew1 joshua1 robert1 thomas1 charlie1
william jasmine hannah samantha elizabeth alexander alexandra victoria natalie sophia olivia emma isabella
mohammad mohammed muhammad ahmad ahmed ali omar hassan hussein fatima maryam mariam
beirut lebanon lebanon1 cedar cedars dubai cairo amman riyadh
udigity udigity1 udigity123 udigityhr hrsystem hr company office business employee employees staff manager
owner developer callcenter dataentry welcome123 welcome2024 welcome2025 welcome2026 welcometoudigity
admin123 admin1234 administrator1 root123 test test123 test1234 testing testing123 tester demo demo123 sample
user user123 username guest123 temp temp123 temporary newuser
12341234 11223344 123454321 1234554321 0987654321 9876543210 147258369 159357 147258 963852741 741852963 123698745
112233445566 123123123 123456123456 111222333 999999999 101010 202020 2580 0000 1212 6969 4321
qwertyuiop123 qwertyqwerty azerty azertyuiop qwertz 1qazxsw2 qazxswedc zxcvbnm123 asdzxc
iloveu loveyou iloveyou2 ihateyou forever always together family friends friend bestfriend
football12 soccer12 hockey12 baseball12 basketball tennis golf golfer runner fitness gym
pokemon naruto minecraft fortnite roblox gaming gamer playstation xbox nintendo zelda mario
starwars1 batman1 spiderman ironman superman123 hulk thor avengers marvel
computer1 internet google yahoo hotmail gmail facebook instagram twitter linkedin microsoft windows apple123
samsung iphone android nokia linux ubuntu
money money123 cash rich dollar dollars million success winner lucky lucky7 lucky13 champion
killer1 hunter1 hunter2 ranger1 shadow12 dragon12 master12 monster demon devil satan
ninja samurai warrior soldier knight king queen prince princesa
peace music guitar piano rock rockstar metal punk jazz dance
secret1 private security secure safety protect protected
open opensesame letmein123 access14 accessdenied
changeme1 changeme123 password! password@ passwordpassword pass1234 pass123 pass12345
mypassword yourpassword newpass mypass p@ssword p@ssw0rd passw0rd1
`;

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  LIST.split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);
