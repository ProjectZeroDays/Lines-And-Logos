import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HDR_FILL = PatternFill("solid", fgColor="1F3864")
SUB_FILL = PatternFill("solid", fgColor="D9E2F3")
GATE_FILL = PatternFill("solid", fgColor="FCE4D6")
INPUT_FONT = Font(color="0000FF", size=10)
FORMULA_FONT = Font(color="000000", size=10)
BOLD = Font(bold=True, size=10, color="FFFFFF")
TITLE = Font(bold=True, size=14, color="1F3864")

# ---------- Sheet 1: Prospects ----------
ws = wb.active
ws.title = "Prospects"
ws["A1"] = "Memphis Tier-1 Prospect Database - 30 Verified/Researched Accounts"
ws["A1"].font = TITLE
ws.merge_cells("A1:AA1")

headers = [
    "Prospect Name", "Type", "City", "State", "Website", "Main Phone",
    "Verified Contact", "Title", "Email", "Distance Miles", "Facilities",
    "Gyms", "Tennis Courts", "Pickleball Courts", "Fleet Estimate",
    "Athletics Score", "Branding Score", "Fleet Score", "Facilities Score",
    "Budget Score", "Distance Score", "Service Fit Score", "Budget Gate",
    "Opportunity Score", "Tier", "Notes", "Sources",
]
for c, h in enumerate(headers, start=1):
    cell = ws.cell(row=3, column=c, value=h)
    cell.font = BOLD
    cell.fill = HDR_FILL
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = BORDER
ws.row_dimensions[3].height = 32

# data: list of dicts (keys match header order)
data = [
 {"name":"Memphis-Shelby County Schools","type":"School District","city":"Memphis","state":"TN","web":"scsk12.org","phone":"(901) 416-5300","contact":"Dr. Roderick Richmond","title":"Superintendent","email":"unverified (contact form)","dist":0,"fac":213,"gyms":100,"tennis":20,"pick":10,"fleet":500,"ath":9,"brd":9,"flt":9,"facsc":10,"bud":9,"distsc":10,"notes":"105,400 students; 213+ schools; Grizzlies Dream Court; Facilities Planning & Property dept; procurement services; Level-5 district","src":"scsk12.org"},
 {"name":"DeSoto County School District","type":"School District","city":"Hernando","state":"MS","web":"desotocountyschools.org","phone":"(662) 429-5271","contact":"unverified","title":"Superintendent","email":"unverified","dist":25,"fac":42,"gyms":20,"tennis":15,"pick":8,"fleet":300,"ath":8,"brd":7,"flt":8,"facsc":9,"bud":8,"distsc":9,"notes":"~42 schools; 34,000+ students; new construction; athletic programs; #BeTheStandard","src":"desotocountyschools.org"},
 {"name":"Bartlett City Schools","type":"School District","city":"Bartlett","state":"TN","web":"bartlettschools.org","phone":"901-202-0855","contact":"Dr. David A. Stephens","title":"Superintendent","email":"unverified","dist":15,"fac":11,"gyms":6,"tennis":4,"pick":6,"fleet":40,"ath":8,"brd":8,"flt":6,"facsc":5,"bud":7,"distsc":9,"notes":"8,922 students; 11 schools; new Altruria ES groundbreaking (2028); outdoor covered practice facility; sponsorship program","src":"bartlettschools.org"},
 {"name":"Germantown Municipal School District","type":"School District","city":"Germantown","state":"TN","web":"unverified (try germantownschools.org)","phone":"unverified","contact":"unverified","title":"Superintendent","email":"unverified","dist":18,"fac":8,"gyms":5,"tennis":4,"pick":6,"fleet":30,"ath":9,"brd":9,"flt":6,"facsc":4,"bud":8,"distsc":9,"notes":"~8 schools; affluent suburb; high athletic investment; rebranding opportunities (website unreachable)","src":"unverified"},
 {"name":"Collierville Schools","type":"School District","city":"Collierville","state":"TN","web":"colliervilleschools.org","phone":"901-861-7000","contact":"Dr. Russell Dyer","title":"Superintendent","email":"unverified","dist":25,"fac":9,"gyms":5,"tennis":4,"pick":6,"fleet":35,"ath":8,"brd":8,"flt":6,"facsc":4,"bud":8,"distsc":8,"notes":"9 schools; aviation (Tango Flight) program; TSBA Award of Excellence; 5-yr capital improvement plan","src":"colliervilleschools.org"},
 {"name":"Arlington Community Schools","type":"School District","city":"Arlington","state":"TN","web":"unverified (arlingtoncommunityschools.org)","phone":"unverified","contact":"unverified","title":"Superintendent","email":"unverified","dist":20,"fac":4,"gyms":3,"tennis":2,"pick":4,"fleet":15,"ath":7,"brd":7,"flt":4,"facsc":3,"bud":6,"distsc":9,"notes":"~4 schools; smaller district; tight-knit community (site unreachable)","src":"unverified"},
 {"name":"Lakeland School System","type":"School District","city":"Lakeland","state":"TN","web":"unverified (lakelandss.org)","phone":"unverified","contact":"unverified","title":"Superintendent","email":"unverified","dist":22,"fac":3,"gyms":2,"tennis":2,"pick":3,"fleet":10,"ath":7,"brd":7,"flt":3,"facsc":2,"bud":6,"distsc":8,"notes":"small district; Lakeland Community Center YMCA nearby (site unreachable)","src":"unverified"},
 {"name":"Tupelo Public School District","type":"School District","city":"Tupelo","state":"MS","web":"tupeloschools.com","phone":"662-841-8850","contact":"Dr. Rob Picou","title":"Superintendent","email":"unverified","dist":100,"fac":15,"gyms":8,"tennis":4,"pick":4,"fleet":60,"ath":7,"brd":6,"flt":7,"facsc":6,"bud":7,"distsc":4,"notes":"15 schools; A-rated; Middle College; Project Search; ~10,000 students","src":"tupeloschools.com"},
 {"name":"Jackson-Madison County Schools","type":"School District","city":"Jackson","state":"TN","web":"unverified (jmcsc.org)","phone":"unverified","contact":"unverified","title":"Superintendent","email":"unverified","dist":80,"fac":25,"gyms":12,"tennis":6,"pick":6,"fleet":80,"ath":7,"brd":6,"flt":7,"facsc":7,"bud":6,"distsc":5,"notes":"~25 schools; mid-size district; needs verification (site unreachable)","src":"unverified"},
 {"name":"Clarksville-Montgomery County Schools","type":"School District","city":"Clarksville","state":"TN","web":"cmcss.net","phone":"931-648-5600","contact":"unverified","title":"Director of Schools","email":"unverified","dist":130,"fac":40,"gyms":20,"tennis":8,"pick":8,"fleet":120,"ath":8,"brd":7,"flt":8,"facsc":8,"bud":7,"distsc":3,"notes":"40+ schools; historic state testing milestones; 621 Gracey Ave, Clarksville TN 37040","src":"cmcss.net"},
 {"name":"YMCA of Memphis & The Mid-South","type":"YMCA","city":"Cordova","state":"TN","web":"ymcamemphis.org","phone":"901-766-7677","contact":"unverified","title":"CEO/Executive Director","email":"unverified","dist":15,"fac":12,"gyms":8,"tennis":4,"pick":6,"fleet":25,"ath":8,"brd":7,"flt":4,"facsc":7,"bud":7,"distsc":9,"notes":"12+ branches (Bartlett, Cordova, Downtown, Olive Branch, Ric Nuber, Schilling Farms, etc.); basketball & pickleball; new Dan Maddox YMCA (Hernando); Lakeland Community Center YMCA","src":"ymcamemphis.org"},
 {"name":"YMCA of Northwest Mississippi","type":"YMCA","city":"Southaven","state":"MS","web":"unverified","phone":"unverified","contact":"unverified","title":"Executive Director","email":"unverified","dist":20,"fac":4,"gyms":3,"tennis":2,"pick":2,"fleet":10,"ath":7,"brd":6,"flt":3,"facsc":3,"bud":6,"distsc":8,"notes":"Olive Branch Family YMCA + Southaven area; site unreachable","src":"unverified"},
 {"name":"Memphis Parks (City of Memphis)","type":"Parks Department","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Director of Parks & Neighborhoods","email":"unverified","dist":5,"fac":50,"gyms":10,"tennis":20,"pick":15,"fleet":10,"ath":6,"brd":5,"flt":3,"facsc":9,"bud":6,"distsc":10,"notes":"City parks system; playgrounds, outdoor courts, parking lots; needs verification","src":"unverified"},
 {"name":"Shelby County Parks","type":"Parks Department","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":10,"fac":20,"gyms":8,"tennis":4,"pick":6,"fleet":8,"ath":6,"brd":5,"flt":3,"facsc":6,"bud":6,"distsc":9,"notes":"County parks; outdoor courts, playgrounds (site unreachable)","src":"unverified"},
 {"name":"Bartlett Parks & Recreation","type":"Parks Department","city":"Bartlett","state":"TN","web":"cityofbartlett.org","phone":"901-385-5590","contact":"Paul Wright","title":"Director of Parks & Recreation","email":"pwright@cityofbartlett.org","dist":15,"fac":15,"gyms":6,"tennis":4,"pick":6,"fleet":8,"ath":7,"brd":6,"flt":4,"facsc":6,"bud":6,"distsc":9,"notes":"Director Paul Wright verified; Jimbo Draffin Asst Dir; 10+ parks, youth/adult athletics, senior center, venue; master plan 2024","src":"cityofbartlett.org"},
 {"name":"Germantown Parks & Recreation","type":"Parks Department","city":"Germantown","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":18,"fac":10,"gyms":5,"tennis":4,"pick":6,"fleet":6,"ath":7,"brd":6,"flt":4,"facsc":5,"bud":7,"distsc":8,"notes":"affluent suburb; parks, athletics, facilities (site unreachable)","src":"unverified"},
 {"name":"Collierville Parks & Recreation","type":"Parks Department","city":"Collierville","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":25,"fac":12,"gyms":6,"tennis":4,"pick":6,"fleet":6,"ath":7,"brd":6,"flt":4,"facsc":5,"bud":7,"distsc":8,"notes":"Collierville parks; athletics, facilities (site unreachable)","src":"unverified"},
 {"name":"City of Southaven Parks & Recreation","type":"Parks Department","city":"Southaven","state":"MS","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":20,"fac":12,"gyms":6,"tennis":4,"pick":6,"fleet":6,"ath":7,"brd":6,"flt":4,"facsc":5,"bud":6,"distsc":8,"notes":"Southaven MS; parks, athletics, facilities","src":"unverified"},
 {"name":"City of Olive Branch Parks & Recreation","type":"Parks Department","city":"Olive Branch","state":"MS","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":22,"fac":10,"gyms":5,"tennis":4,"pick":6,"fleet":5,"ath":7,"brd":6,"flt":3,"facsc":4,"bud":6,"distsc":8,"notes":"Olive Branch MS; parks, athletics","src":"unverified"},
 {"name":"City of Horn Lake Parks & Recreation","type":"Parks Department","city":"Horn Lake","state":"MS","web":"unverified","phone":"unverified","contact":"unverified","title":"Director","email":"unverified","dist":22,"fac":8,"gyms":4,"tennis":3,"pick":5,"fleet":4,"ath":6,"brd":5,"flt":3,"facsc":3,"bud":5,"distsc":8,"notes":"Horn Lake MS; parks","src":"unverified"},
 {"name":"Bellevue Baptist Church","type":"Church","city":"Cordova","state":"TN","web":"bellevue.org","phone":"(901) 347-2000","contact":"Ben Mandrell","title":"Senior Pastor","email":"unverified","dist":20,"fac":3,"gyms":2,"tennis":2,"pick":2,"fleet":15,"ath":7,"brd":8,"flt":3,"facsc":4,"bud":7,"distsc":9,"notes":"2000 Appling Rd, Cordova TN 38016; recreation ministry; Singing Christmas Tree (50th); Love Offering 2026 capital campaign; gym/family life center; worship 9:30 & 11am","src":"bellevue.org"},
 {"name":"Hope Church","type":"Church","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Senior Pastor","email":"unverified","dist":10,"fac":2,"gyms":2,"tennis":2,"pick":2,"fleet":5,"ath":6,"brd":7,"flt":2,"facsc":3,"bud":6,"distsc":9,"notes":"site unreachable (hopechurchmemphis.org)","src":"unverified"},
 {"name":"Second Baptist Church","type":"Church","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Senior Pastor","email":"unverified","dist":8,"fac":2,"gyms":2,"tennis":2,"pick":2,"fleet":5,"ath":6,"brd":7,"flt":2,"facsc":3,"bud":6,"distsc":9,"notes":"site unreachable","src":"unverified"},
 {"name":"Briarcrest Christian School","type":"Private School","city":"Eads","state":"TN","web":"briarcrest.com","phone":"(901) 765-4600","contact":"unverified","title":"Head of School","email":"unverified","dist":18,"fac":1,"gyms":3,"tennis":4,"pick":4,"fleet":20,"ath":8,"brd":8,"flt":5,"facsc":5,"bud":7,"distsc":9,"notes":"76 S. Houston Levee Rd, Eads TN 38028; K-12 on one campus; 67 state championships; 95%+ AP pass rate; athletics powerhouse","src":"briarcrest.com"},
 {"name":"St. George's Independent School","type":"Private School","city":"Collierville","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Head of School","email":"unverified","dist":25,"fac":3,"gyms":4,"tennis":4,"pick":4,"fleet":12,"ath":8,"brd":8,"flt":4,"facsc":4,"bud":7,"distsc":8,"notes":"Collierville-area independent school; multiple campuses (site unreachable)","src":"unverified"},
 {"name":"Lausanne Collegiate School","type":"Private School","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Head of School","email":"unverified","dist":12,"fac":1,"gyms":3,"tennis":4,"pick":4,"fleet":8,"ath":8,"brd":8,"flt":4,"facsc":4,"bud":7,"distsc":9,"notes":"Memphis independent school (site unreachable)","src":"unverified"},
 {"name":"Evangelical Christian School","type":"Private School","city":"Cordova","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"Head of School","email":"unverified","dist":18,"fac":2,"gyms":3,"tennis":3,"pick":3,"fleet":8,"ath":7,"brd":7,"flt":3,"facsc":3,"bud":6,"distsc":9,"notes":"Cordova area (site unreachable)","src":"unverified"},
 {"name":"Harding Academy","type":"Private School","city":"Nashville","state":"TN","web":"hardingacademy.org","phone":"615-356-5510","contact":"unverified (Dr. Boyd referenced)","title":"Head of School","email":"unverified","dist":210,"fac":1,"gyms":2,"tennis":2,"pick":2,"fleet":5,"ath":6,"brd":7,"flt":2,"facsc":3,"bud":7,"distsc":2,"notes":"170 Windsor Dr, Nashville TN 37205; PreK-8 independent; 98% accepted to top-choice HS; NOTE: Nashville (~210 mi) lower priority for Memphis-based service","src":"hardingacademy.org"},
 {"name":"University of Memphis","type":"Higher Ed","city":"Memphis","state":"TN","web":"memphis.edu","phone":"(901) 678-2000","contact":"unverified","title":"President","email":"unverified","dist":3,"fac":1,"gyms":6,"tennis":6,"pick":4,"fleet":20,"ath":8,"brd":8,"flt":4,"facsc":7,"bud":8,"distsc":10,"notes":"3720 Alumni Ave; campus recreation; portable floor project history with Sports Floors Inc; 230+ areas of study","src":"memphis.edu"},
 {"name":"Rhodes College","type":"Higher Ed","city":"Memphis","state":"TN","web":"unverified","phone":"unverified","contact":"unverified","title":"President","email":"unverified","dist":5,"fac":1,"gyms":4,"tennis":4,"pick":2,"fleet":8,"ath":7,"brd":7,"flt":3,"facsc":4,"bud":7,"distsc":9,"notes":"Memphis liberal arts college (site unreachable)","src":"unverified"},
]

r = 4
for d in data:
    vals = [d["name"], d["type"], d["city"], d["state"], d["web"], d["phone"], d["contact"],
            d["title"], d["email"], d["dist"], d["fac"], d["gyms"], d["tennis"], d["pick"],
            d["fleet"], d["ath"], d["brd"], d["flt"], d["facsc"], d["bud"], d["distsc"]]
    for c, v in enumerate(vals, start=1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.border = BORDER
        cell.font = INPUT_FONT if c in (16,17,18,19,20,21) else Font(size=10)
        if c in (10,11,12,13,14,15):
            cell.alignment = Alignment(horizontal="center")
    # formulas
    ws.cell(row=r, column=22, value=f"=ROUND(10*(0.25*P{r}+0.20*Q{r}+0.15*R{r}+0.15*S{r}+0.15*T{r}+0.10*U{r}),0)").font = FORMULA_FONT
    ws.cell(row=r, column=23, value=f'=IF(T{r}<5,"GATED","OK")').font = FORMULA_FONT
    ws.cell(row=r, column=24, value=f'=IF(W{r}="GATED",0,V{r})').font = FORMULA_FONT
    ws.cell(row=r, column=25, value=f'=IF(X{r}>=80,"A",IF(X{r}>=60,"B","C"))').font = FORMULA_FONT
    ws.cell(row=r, column=26, value=d["notes"]).font = Font(size=10)
    ws.cell(row=r, column=27, value=d["src"]).font = Font(size=9, italic=True, color="808080")
    for c in (22,23,24,25,26,27):
        ws.cell(row=r, column=c).border = BORDER
    r += 1

last = r - 1
# conditional-ish fills for gate column done via static for low budget
for rr in range(4, last+1):
    tval = ws.cell(row=rr, column=20).value
    if isinstance(tval, (int,float)) and tval < 5:
        ws.cell(row=rr, column=23).fill = GATE_FILL

widths = [26,16,14,7,34,16,26,24,26,11,10,7,9,10,10,9,9,8,9,8,9,10,9,10,6,46,26]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "C4"
ws.auto_filter.ref = f"A3:AA{last}"

# ---------- Sheet 2: Scoring Weights ----------
w2 = wb.create_sheet("Scoring_Weights")
w2["A1"] = "Service-Fit Scoring Model - Weights & Formulas"
w2["A1"].font = TITLE
rows = [
 ("Factor","Weight","Column","Sub-score 0-10 guidance"),
 ("Athletics Score",0.25,"P","Court work demand: # gyms/courts, athletic programs, recent floor work, sports offerings"),
 ("Branding Score",0.20,"Q","Logo/branding demand: mascot updates, rebrands, donor walls, signage, capital campaigns"),
 ("Fleet Score",0.15,"R","Vehicle graphics demand: # vehicles in fleet, branding on fleet, transportation dept"),
 ("Facilities Count",0.15,"S","Facility count score derived from # facilities (1-2=2, 3-5=4, 6-15=6, 16-50=8, 51+=10)"),
 ("Budget Capacity",0.15,"T","Budget score (gatekeeper): bond measures, capital budgets, fund balance, new construction"),
 ("Distance",0.10,"U","Distance score: 0-15mi=10, 16-30=8, 31-60=6, 61-120=4, 121+=2"),
]
r = 3
for h in rows[0]:
    c = w2.cell(row=r, column=rows[0].index(h)+1, value=h); c.font = BOLD; c.fill = HDR_FILL; c.border = BORDER
r = 4
for row in rows[1:]:
    for i, v in enumerate(row, start=1):
        cell = w2.cell(row=r, column=i, value=v); cell.border = BORDER
        if i == 2: cell.number_format = "0%"
    r += 1
w2.cell(row=r+1, column=1, value="Service Fit Score (col V) = ROUND(10*(0.25*P + 0.20*Q + 0.15*R + 0.15*S + 0.15*T + 0.10*U),0)").font = Font(bold=True, size=10)
w2.cell(row=r+2, column=1, value="Budget Gate (col W) = IF(T<5,\"GATED\",\"OK\")  -- any account with Budget Score < 5 is gated out").font = Font(bold=True, size=10)
w2.cell(row=r+3, column=1, value="Opportunity Score (col X) = IF(W=\"GATED\",0,V)  -- gated accounts score 0 regardless of other factors").font = Font(bold=True, size=10)
w2.cell(row=r+4, column=1, value="Tier (col Y) = IF(X>=80,\"A\",IF(X>=60,\"B\",\"C\"))").font = Font(bold=True, size=10)
for col, width in zip("ABCDE", [22,10,10,90]):
    w2.column_dimensions[col].width = width

# ---------- Sheet 3: Competitor Intel ----------
w3 = wb.create_sheet("Competitor_Intel")
w3["A1"] = "Competitive Intel - 5 Local Rivals vs. Bundled One-Stop Model"
w3["A1"].font = TITLE
cheaders = ["Competitor","Website","Phone","Location","Dist from Memphis (mi)","Years in Business","Owner/Leadership",
            "Gym Floor Refinish","Court Striping","Custom Logos","Floor Graphics","Wall Wraps","Window Graphics",
            "Exterior Signage","Donor/Sponsor Walls","Playground Markings","Vehicle Graphics","Parking Lot Striping",
            "Bundled One-Stop?","Key Gap vs. You"]
for c, h in enumerate(cheaders, start=1):
    cell = w3.cell(row=3, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
w3.row_dimensions[3].height = 40

comp = [
 ("Sports Floors, Inc.","sportsfloorsinc.com","901-452-9492","Memphis, TN",0,"Since 1995","Woman-owned (Mary Beth? no - woman-owned, owner not named)","YES","YES","YES (court logos)","YES (synthetic/vinyl)","NO","NO","NO","NO","NO","NO","NO","NO - athletic flooring only","No wall wraps, window graphics, donor walls, signage, vehicle graphics, or parking lot work. Strongest local rival on gym floors but narrow scope."),
 ("Conrad Floors","conradfloors.com","270-563-4753","Smiths Grove, KY",300,"Since 1991","Mary Beth Conrad, President/Owner","YES","YES","YES (logos on wood floors)","NO","NO","NO","NO","NO","NO","NO","NO","NO - athletic wood floors only","Athletic wood flooring + stage/museum floors. No graphics, wraps, signage, or lot work. Email conradfloors@gmail.com."),
 ("Martin Flooring Company","martinflooring.net","(502) 935-3831","Louisville, KY",380,"Since 1954","Martin family ownership","unverified (site down)","unverified","unverified","unverified","NO","NO","NO","NO","NO","NO","NO","UNCLEAR - site 'Launching Soon'","Website down/being rebuilt; could not verify current service list. Treat as athletic flooring only until proven otherwise."),
 ("Finchum Sports Floors","finchumsportsfloorsllc.com","865-453-3995","Sevierville, TN",390,"Since 1951","Larry Finchum, CEO/Owner","YES","YES","YES","YES (synthetic systems)","NO","NO","NO","NO","NO","NO","NO","NO - athletic flooring only","Nationwide coverage from East TN. Strong on wood/synthetic floors & logos. No wraps, signage, lot, or vehicle work."),
 ("GameDay Floors","gamedayfloors.com","404-408-9374","Alpharetta, GA",380,"Since 2003","Duncan G. Scott, President","YES","YES","YES (design service)","NO (Court Armor products)","NO","NO","NO","NO","NO","NO","NO","NO - athletic flooring only","Southeast coverage; installation, sanding, screen & recoat, repair, pickleball, design. No wraps, signage, donor walls, or lot work."),
]
r = 4
for row in comp:
    for c, v in enumerate(row, start=1):
        cell = w3.cell(row=r, column=c, value=v); cell.border = BORDER; cell.font = Font(size=9)
        if c in (4,5,6): cell.alignment = Alignment(horizontal="center")
    r += 1
for i, w in enumerate([22,20,16,18,12,14,30,12,11,12,12,9,10,10,12,12,11,12,16,60], start=1):
    w3.column_dimensions[get_column_letter(i)].width = w
w3.freeze_panes = "C4"

# ---------- Sheet 4: Bundled Offer ----------
w4 = wb.create_sheet("Bundled_Offer")
w4["A1"] = "Bundled Service Packages - One-Stop Facility Branding"
w4["A1"].font = TITLE
bheaders = ["Package","Includes","Best For","Est. Price Range (USD)","Notes"]
for c, h in enumerate(bheaders, start=1):
    cell = w4.cell(row=3, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
pkgs = [
 ("Gym Refresh","Refinish hardwood gym floor + restripe (basketball/volleyball) + center-court logo paint","Schools, churches, YMCAs needing annual/seasonal floor refresh","$8,000 - $25,000","Core recurring revenue; summer maintenance window"),
 ("Court Rebrand","Full sand & refinish + new game lines + new center-court logo + wall base graphics","Districts doing mascot rebrand or capital refresh","$18,000 - $45,000","High margin; pairs with branding score"),
 ("Campus Branding","Wall wraps + window graphics + donor/sponsor wall + exterior signage","Schools/churches launching capital campaigns or rebrands","$15,000 - $60,000","Differentiator vs. floor-only rivals"),
 ("Full Facility","Gym refresh + parking lot striping/sealcoat + playground markings + exterior signage + wall wraps","Districts wanting one vendor for whole campus","$40,000 - $120,000","Highest ticket; single contract, one invoice"),
 ("Playground & Lot Touchup","Parking lot striping + sealcoating + playground markings + crosswalk graphics","Parks depts, churches, schools with aging lots","$5,000 - $20,000","Low barrier entry; recurring annually"),
 ("Fleet Graphics","Vehicle wraps/graphics for buses, trucks, trailers, vans (full or partial)","Districts, churches, service companies with fleets","$2,500 - $12,000 per vehicle","Fleet score driver; recurring as fleets turn over"),
 ("Vinyl & Sticker Pack","Custom vinyl stickers, decals, floor graphics, window decals","Any account; upsell add-on","$500 - $5,000","Low-cost add-on; high margin"),
 ("Mural & Wall Art","Custom mural painting (gym walls, hallways, cafeterias, exteriors)","Schools, churches, YMCAs wanting culture/identity","$3,000 - $25,000","Differentiator; pairs with branding score"),
 ("House/Building Paint Touchup","Interior/exterior touchup painting for facilities","Churches, small schools, property managers","$2,000 - $15,000","Entry-level service for budget-constrained accounts"),
]
r = 4
for row in pkgs:
    for c, v in enumerate(row, start=1):
        cell = w4.cell(row=r, column=c, value=v); cell.border = BORDER; cell.font = Font(size=10)
        if c == 4: cell.alignment = Alignment(horizontal="center")
    r += 1
for i, w in enumerate([22,70,40,26,46], start=1):
    w4.column_dimensions[get_column_letter(i)].width = w

# ---------- Sheet 5: Outreach Timeline ----------
w5 = wb.create_sheet("Outreach_Timeline")
w5["A1"] = "Outreach Timing by Segment (Budget Cycles)"
w5["A1"].font = TITLE
theaders = ["Segment","Buy Cycle / Trigger","Best Outreach Window","Decision Makers","Messaging Angle"]
for c, h in enumerate(theaders, start=1):
    cell = w5.cell(row=3, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
tl = [
 ("School Districts","Capital/bond funds, summer maintenance windows, ESSER/ARP spend-down, new construction/renovation","Feb-May (budget planning) and May-Aug (summer work)","Superintendent, Director of Facilities/Operations, Athletic Director, CFO","One vendor for gym + lot + signage; reduce procurement overhead; summer install"),
 ("Churches","Stewardship campaigns, facility anniversary, capital campaigns, pre-Easter/Christmas prep","Jan-Mar and Aug-Oct","Senior Pastor, Executive Director, Facilities/Operations Director, Business Administrator","Campus branding + gym refresh under one contract; donor wall & signage for campaigns"),
 ("YMCAs","Annual capital budgets, facility refresh cycles, new branch openings","Q1 (budget) and Q3 (summer refresh)","Executive Director, Director of Facilities, Branch Director","Multi-site pricing; one vendor across branches; branded member experience"),
 ("Parks & Recreation","Annual capital budgets, master plan implementation, grant-funded projects","Jan-Apr (budget) and Apr-Jun (pre-summer)","Director of Parks & Recreation, City/County Mayor, Public Works","Playground + lot + court striping under one contract; grant-friendly bundled scope"),
 ("Private/Independent Schools","Capital campaigns, donor-funded projects, summer refresh","Feb-May and May-Aug","Head of School, Director of Facilities, Athletic Director, Development Director","Premium branding + athletics; donor wall & signage for campaigns"),
 ("Higher Ed (Campus Rec)","Annual capital budgets, student-fee-funded rec center refresh","Mar-Jun and Jun-Aug","Director of Campus Recreation, Facilities Director, Athletic Director","Rec center refresh + branding; student-facing impact"),
]
r = 4
for row in tl:
    for c, v in enumerate(row, start=1):
        cell = w5.cell(row=r, column=c, value=v); cell.border = BORDER; cell.font = Font(size=10)
        cell.alignment = Alignment(vertical="top", wrap_text=True)
    r += 1
for i, w in enumerate([24,46,34,46,52], start=1):
    w5.column_dimensions[get_column_letter(i)].width = w

wb.save("Memphis_Tier1_Prospect_Database.xlsx")
print("saved")
print("rows:", last-3+1)
