import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

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
ITALIC = Font(size=9, italic=True, color="808080")

ws = wb.active
ws.title = "Prospects"
ws["A1"] = "Tier-2 Research Template - 100 Prospect Slots (fill in via live web research)"
ws["A1"].font = TITLE
ws.merge_cells("A1:AA1")
ws["A2"] = "Instructions: one row per account. Score each sub-factor 0-10. Service Fit Score, Budget Gate, Opportunity Score, and Tier calculate automatically. Budget Score < 5 = GATED (Opportunity = 0)."
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

# Type dropdown
dv = DataValidation(type="list", formula1='"School District,Private School,Church,YMCA,Parks Department,Higher Ed,Other"', allow_blank=True)
ws.add_data_validation(dv)
dv.add("B5:B104")

# Tier dropdown hint via data (none needed)

# 100 blank rows with formulas pre-filled, light input shading on score cols
for r in range(5, 105):
    for c in (16,17,18,19,20,21):
        cell = ws.cell(row=r, column=c)
        cell.fill = PatternFill("solid", fgColor="FFF2CC")  # light yellow = input
        cell.border = BORDER
        cell.alignment = Alignment(horizontal="center")
    for c in (10,11,12,13,14,15):
        cell = ws.cell(row=r, column=c)
        cell.fill = PatternFill("solid", fgColor="DDEBF7")  # light blue = input
        cell.border = BORDER
        cell.alignment = Alignment(horizontal="center")
    for c in (1,2,3,4,5,6,7,8,9,26,27):
        ws.cell(row=r, column=c).border = BORDER
    # formulas
    ws.cell(row=r, column=22, value=f"=IF(COUNT(P{r}:U{r})=0,\"\",ROUND(10*(0.25*P{r}+0.20*Q{r}+0.15*R{r}+0.15*S{r}+0.15*T{r}+0.10*U{r}),0))").font = FORMULA_FONT
    ws.cell(row=r, column=23, value=f'=IF(T{r}="","",IF(T{r}<5,"GATED","OK"))').font = FORMULA_FONT
    ws.cell(row=r, column=24, value=f'=IF(W{r}="GATED",0,IF(W{r}="","",V{r}))').font = FORMULA_FONT
    ws.cell(row=r, column=25, value=f'=IF(X{r}="","",IF(X{r}>=80,"A",IF(X{r}>=60,"B","C")))').font = FORMULA_FONT
    for c in (22,23,24,25):
        ws.cell(row=r, column=c).border = BORDER
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center")

widths = [26,16,14,7,34,16,26,24,26,11,10,7,9,10,10,9,9,8,9,8,9,10,9,10,6,46,26]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "C5"
ws.auto_filter.ref = "A4:AA104"

# legend sheet
w2 = wb.create_sheet("Scoring_Guide")
w2["A1"] = "Tier-2 Scoring Guide"
w2["A1"].font = TITLE
guide = [
 ("Sub-score","Weight","0-10 guidance"),
 ("Athletics Score",0.25,"Court work demand: # gyms/courts, athletic programs, recent floor work, sports offerings"),
 ("Branding Score",0.20,"Logo/branding demand: mascot updates, rebrands, donor walls, signage, capital campaigns"),
 ("Fleet Score",0.15,"Vehicle graphics demand: # vehicles in fleet, branding on fleet, transportation dept"),
 ("Facilities Score",0.15,"1-2 facilities=2, 3-5=4, 6-15=6, 16-50=8, 51+=10"),
 ("Budget Score",0.15,"GATEKEEPER: bond measures, capital budgets, fund balance, new construction. <5 = GATED"),
 ("Distance Score",0.10,"0-15mi=10, 16-30=8, 31-60=6, 61-120=4, 121+=2"),
]
r=3
for h in guide[0]:
    c=w2.cell(row=r,column=guide[0].index(h)+1,value=h); c.font=BOLD; c.fill=HDR_FILL; c.border=BORDER
r=4
for row in guide[1:]:
    for i,v in enumerate(row,start=1):
        cell=w2.cell(row=r,column=i,value=v); cell.border=BORDER
        if i==2: cell.number_format="0%"
    r+=1
w2.cell(row=r+1,column=1,value="Service Fit Score = ROUND(10*(0.25*P+0.20*Q+0.15*R+0.15*S+0.15*T+0.10*U),0)").font=Font(bold=True,size=10)
w2.cell(row=r+2,column=1,value='Budget Gate = IF(T<5,"GATED","OK")').font=Font(bold=True,size=10)
w2.cell(row=r+3,column=1,value='Opportunity Score = IF(GATED,0,ServiceFit)').font=Font(bold=True,size=10)
w2.cell(row=r+4,column=1,value='Tier = IF(Opp>=80,"A",IF(Opp>=60,"B","C"))').font=Font(bold=True,size=10)
for col,w in zip("ABC",[22,12,90]):
    w2.column_dimensions[col].width=w

# Sources sheet
w3 = wb.create_sheet("Source_Guide")
w3["A1"]="Research Source Guide - where to find each field"
w3["A1"].font=TITLE
sg = [
 ("Field","Where to find it"),
 ("Prospect Name","Official district/org name from website"),
 ("Type","School District / Private School / Church / YMCA / Parks Department / Higher Ed / Other"),
 ("City, State","Official address"),
 ("Website","Official .org/.gov/.com site"),
 ("Main Phone","Contact page or footer"),
 ("Verified Contact","Superintendent / ED / Pastor / Head of School / Director of Facilities / Athletic Director"),
 ("Title","Their official title"),
 ("Email","Public email (info@, firstname.lastname@) - mark unverified if not found"),
 ("Distance Miles","Driving miles from downtown Memphis (use Google Maps)"),
 ("Facilities","Number of campuses/schools/branches/parks"),
 ("Gyms","Number of gymnasiums"),
 ("Tennis Courts","Number of tennis courts"),
 ("Pickleball Courts","Number of pickleball courts"),
 ("Fleet Estimate","Number of buses/vehicles in fleet (est.)"),
 ("Athletics Score","0-10: court work demand"),
 ("Branding Score","0-10: logo/branding demand"),
 ("Fleet Score","0-10: vehicle graphics demand"),
 ("Facilities Score","0-10: derived from facility count"),
 ("Budget Score","0-10: GATEKEEPER - bond measures, capital budgets, new construction"),
 ("Distance Score","0-10: 0-15mi=10, 16-30=8, 31-60=6, 61-120=4, 121+=2"),
 ("Notes","Recent triggers: bond, rebrand, new construction, capital campaign, new hire"),
 ("Sources","URL(s) where info was verified"),
]
r=3
for h in sg[0]:
    c=w3.cell(row=r,column=sg[0].index(h)+1,value=h); c.font=BOLD; c.fill=HDR_FILL; c.border=BORDER
r=4
for row in sg[1:]:
    for i,v in enumerate(row,start=1):
        cell=w3.cell(row=r,column=i,value=v); cell.border=BORDER; cell.font=Font(size=10)
    r+=1
w3.column_dimensions["A"].width=22
w3.column_dimensions["B"].width=90

wb.save("Tier2_Research_Template.xlsx")
print("saved Tier2_Research_Template.xlsx")
