import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

wb = openpyxl.Workbook()
thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HDR_FILL = PatternFill("solid", fgColor="548235")
SUB_FILL = PatternFill("solid", fgColor="E2EFDA")
GATE_FILL = PatternFill("solid", fgColor="FCE4D6")
INPUT_FONT = Font(color="0000FF", size=10)
FORMULA_FONT = Font(color="000000", size=10)
BOLD = Font(bold=True, size=10, color="FFFFFF")
TITLE = Font(bold=True, size=14, color="548235")
ITALIC = Font(size=9, italic=True, color="808080")

ws = wb.active
ws.title = "Prospects"
ws["A1"] = "Tier-3 Long-Tail Prospect Template - 100 Slots (smaller/longer-distance accounts)"
ws["A1"].font = TITLE
ws.merge_cells("A1:AA1")
ws["A2"] = "Tier-3 = smaller schools, rural districts, small churches, individual facilities, longer-distance (60-400 mi). Scoring weights shift: Distance + Budget matter more; Fleet/Branding less. Add-on packages (vinyl, murals, paint touchup, lot striping) are the entry point. Live web research required."
ws["A2"].font = ITALIC
ws.merge_cells("A2:AA2")

headers = [
    "Prospect Name", "Type", "City", "State", "Website", "Main Phone",
    "Verified Contact", "Title", "Email", "Distance Miles", "Facilities",
    "Gyms", "Tennis Courts", "Pickleball Courts", "Fleet Estimate",
    "Athletics Score", "Branding Score", "Fleet Score", "Facilities Score",
    "Budget Score", "Distance Score", "Service Fit Score", "Budget Gate",
    "Opportunity Score", "Tier", "Notes", "Sources",
]
for c, h in enumerate(headers, start=1):
    cell = ws.cell(row=4, column=c, value=h)
    cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws.row_dimensions[4].height = 32

dv = DataValidation(type="list", formula1='"School District,Private School,Church,YMCA,Parks Department,Higher Ed,Rural School,Other"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("B5:B104")

for r in range(5, 105):
    for c in (16,17,18,19,20,21):
        cell = ws.cell(row=r, column=c)
        cell.fill = PatternFill("solid", fgColor="FFF2CC")
        cell.border = BORDER; cell.alignment = Alignment(horizontal="center")
    for c in (10,11,12,13,14,15):
        cell = ws.cell(row=r, column=c)
        cell.fill = PatternFill("solid", fgColor="DDEBF7")
        cell.border = BORDER; cell.alignment = Alignment(horizontal="center")
    for c in (1,2,3,4,5,6,7,8,9,26,27):
        ws.cell(row=r, column=c).border = BORDER
    ws.cell(row=r, column=22, value=f"=IF(COUNT(P{r}:U{r})=0,\"\",ROUND(10*(0.20*P{r}+0.15*Q{r}+0.10*R{r}+0.10*S{r}+0.25*T{r}+0.20*U{r}),0))").font = FORMULA_FONT
    ws.cell(row=r, column=23, value=f'=IF(T{r}="","",IF(T{r}<4,"GATED","OK"))').font = FORMULA_FONT
    ws.cell(row=r, column=24, value=f'=IF(W{r}="GATED",0,IF(W{r}="","",V{r}))').font = FORMULA_FONT
    ws.cell(row=r, column=25, value=f'=IF(X{r}="","",IF(X{r}>=70,"A",IF(X{r}>=50,"B","C")))').font = FORMULA_FONT
    for c in (22,23,24,25):
        ws.cell(row=r, column=c).border = BORDER
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center")

widths = [26,16,14,7,34,16,26,24,26,11,10,7,9,10,10,9,9,8,9,8,9,10,9,10,6,46,26]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "C5"
ws.auto_filter.ref = "A4:AA104"

# Sourcing guide sheet
w2 = wb.create_sheet("Sourcing_Guide")
w2["A1"] = "Tier-3 Sourcing Guide - where to find long-tail accounts"
w2["A1"].font = TITLE
sg = [
 ("Segment","Where to find them","Entry service","Notes"),
 ("Rural school districts","State DOE district lists (TN DOE, MS DOE, AR DOE); NCES district search; local newspaper","Gym Refresh (small gym), lot striping","Lower budgets; longer drive; bundle travel into quote"),
 ("Small private schools","State independent school associations (TAIS, MAIS); church directories","Gym Refresh, mural, vinyl stickers","Often donor-funded; pitch donor wall + signage"),
 ("Small churches","Denomination directories (SBC, UMC, COGIC, Baptist state conventions); Google Maps 'church near X'","Mural, paint touchup, lot striping, vinyl","Entry via mural/paint; upsell to wall wraps"),
 ("Rural parks & rec","County government websites; state parks & rec associations","Playground markings, lot striping","Grant-funded (LWCF, RTP); itemize for grants"),
 ("Individual facilities","Google Maps + 'gym near me' + Facebook community groups","Vinyl stickers, small murals, lot touchup","Lowest ticket; high volume; referral-driven"),
 ("Youth sports leagues","Local Little League, soccer, basketball league websites","Court striping, logos on fields","Recurring seasonal work"),
 ("Community centers","City/county community center lists; YMCAs in small towns","Gym refresh, wall wraps","Often underfunded; pitch phased approach"),
]
r=3
for h in sg[0]:
    c=w2.cell(row=r,column=sg[0].index(h)+1,value=h); c.font=BOLD; c.fill=HDR_FILL; c.border=BORDER
r=4
for row in sg[1:]:
    for i,v in enumerate(row,start=1):
        cell=w2.cell(row=r,column=i,value=v); cell.border=BORDER; cell.font=Font(size=10)
        cell.alignment=Alignment(vertical="top",wrap_text=True)
    r+=1
for col,w in zip("ABCD",[26,52,34,46]):
    w2.column_dimensions[col].width=w

# Scoring guide (Tier-3 weights differ)
w3 = wb.create_sheet("Scoring_Guide")
w3["A1"]="Tier-3 Scoring Guide (weights shift vs Tier-1)"
w3["A1"].font=TITLE
guide=[
 ("Sub-score","Weight","Tier-3 guidance"),
 ("Athletics Score",0.20,"Court work demand (lower weight - smaller facilities)"),
 ("Branding Score",0.15,"Logo/branding demand (lower weight)"),
 ("Fleet Score",0.10,"Vehicle graphics demand (lower weight - smaller fleets)"),
 ("Facilities Score",0.10,"1-2=2, 3-5=4, 6-15=6, 16-50=8, 51+=10"),
 ("Budget Score",0.25,"GATEKEEPER (higher weight): small budgets gate harder. <4 = GATED"),
 ("Distance Score",0.20,"Higher weight: 0-30mi=10, 31-60=8, 61-120=6, 121-200=4, 201+=2"),
]
r=3
for h in guide[0]:
    c=w3.cell(row=r,column=guide[0].index(h)+1,value=h); c.font=BOLD; c.fill=HDR_FILL; c.border=BORDER
r=4
for row in guide[1:]:
    for i,v in enumerate(row,start=1):
        cell=w3.cell(row=r,column=i,value=v); cell.border=BORDER
        if i==2: cell.number_format="0%"
    r+=1
w3.cell(row=r+1,column=1,value="Service Fit Score = ROUND(10*(0.20*P+0.15*Q+0.10*R+0.10*S+0.25*T+0.20*U),0)").font=Font(bold=True,size=10)
w3.cell(row=r+2,column=1,value='Budget Gate = IF(T<4,"GATED","OK")').font=Font(bold=True,size=10)
w3.cell(row=r+3,column=1,value='Opportunity Score = IF(GATED,0,ServiceFit)').font=Font(bold=True,size=10)
w3.cell(row=r+4,column=1,value='Tier = IF(Opp>=70,"A",IF(Opp>=50,"B","C"))').font=Font(bold=True,size=10)
for col,w in zip("ABC",[22,12,70]):
    w3.column_dimensions[col].width=w

wb.save("Tier3_Research_Template.xlsx")
print("saved Tier3_Research_Template.xlsx")
