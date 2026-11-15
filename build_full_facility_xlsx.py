import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HDR_FILL = PatternFill("solid", fgColor="1F3864")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
CALC_FILL = PatternFill("solid", fgColor="DDEBF7")
GREEN_FILL = PatternFill("solid", fgColor="C6EFCE")
BOLD = Font(bold=True, size=10, color="FFFFFF")
TITLE = Font(bold=True, size=14, color="1F3864")
ITALIC = Font(size=9, italic=True, color="808080")
INPUT_FONT = Font(color="0000FF", size=10)
FORMULA_FONT = Font(color="000000", size=10)

# ---------- Sheet 1: Proposal Info ----------
ws = wb.active
ws.title = "Proposal_Info"
ws["A1"] = "Lines & Logos - Full Facility Branding & Athletic Surface Program"
ws["A1"].font = TITLE
ws.merge_cells("A1:D1")
info = [
    ("Client Organization", "{{Client Name}}"),
    ("Address", "{{Street, City, State ZIP}}"),
    ("Contact Name", "{{Contact Name}}"),
    ("Contact Title", "{{Title}}"),
    ("Phone", "{{phone}}"),
    ("Email", "{{email}}"),
    ("Proposal #", "L&L-{{YYYY}}-{{NNN}}"),
    ("Date", "{{date}}"),
    ("Prepared by", "{{Sender Name}}"),
    ("Valid through", "{{date + 30 days}}"),
    ("Install window", "May-August (summer)"),
    ("Payment terms", "50% deposit, 50% on completion"),
]
r = 3
for label, val in info:
    ws.cell(row=r, column=1, value=label).font = Font(bold=True, size=10)
    c = ws.cell(row=r, column=2, value=val)
    c.fill = INPUT_FILL; c.font = INPUT_FONT
    ws.cell(row=r, column=1).border = BORDER; c.border = BORDER
    r += 1
ws.column_dimensions["A"].width = 24
ws.column_dimensions["B"].width = 40

# ---------- Sheet 2: Unit Prices ----------
up = wb.create_sheet("Unit_Prices")
up["A1"] = "Unit Price List (adjust in yellow)"
up["A1"].font = TITLE
up.merge_cells("A1:E1")
for c, h in enumerate(["Line Item","Unit","Low ($)","High ($)","Default ($)"], start=1):
    cell = up.cell(row=3, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", wrap_text=True)
prices = [
 ("Floor assessment (moisture/flatness/finish eval)","visit",0,0,0),
 ("Screen & recoat (annual)","sq ft",1.50,3.00,2.25),
 ("Full sand & refinish","sq ft",4.00,8.00,6.00),
 ("Court striping - basketball","court",400,900,650),
 ("Court striping - volleyball","court",400,900,650),
 ("Court striping - pickleball","court",300,700,500),
 ("Center-court logo paint","logo",1200,3500,2000),
 ("Logo design (new)","design",500,1500,900),
 ("Wall wraps","sq ft",8,18,12),
 ("Window graphics","sq ft",6,14,10),
 ("Exterior signage","sign",300,1200,700),
 ("Wayfinding signs","sign",150,400,250),
 ("Donor wall (design + install)","linear ft",150,400,250),
 ("Donor name plaque","plaque",75,200,125),
 ("Parking lot striping","space",8,18,12),
 ("Sealcoating","sq ft",0.15,0.40,0.25),
 ("Playground markings","area",500,2000,1200),
 ("Crosswalk graphics","crosswalk",200,600,350),
 ("Fleet graphics (full wrap)","vehicle",2500,8000,4500),
 ("Fleet graphics (partial/decal)","vehicle",500,2500,1200),
 ("Mural painting","sq ft",15,40,25),
 ("House/building paint touchup","sq ft",2,6,4),
 ("Vinyl sticker pack","pack",500,5000,2000),
]
r = 4
price_map = {}
for name, unit, lo, hi, dflt in prices:
    up.cell(row=r, column=1, value=name).font = Font(size=10)
    up.cell(row=r, column=2, value=unit).alignment = Alignment(horizontal="center")
    up.cell(row=r, column=3, value=lo).number_format = "$#,##0.00"
    up.cell(row=r, column=4, value=hi).number_format = "$#,##0.00"
    c = up.cell(row=r, column=5, value=dflt)
    c.fill = INPUT_FILL; c.number_format = "$#,##0.00"; c.font = INPUT_FONT
    for cc in range(1,6): up.cell(row=r, column=cc).border = BORDER
    price_map[name] = r
    r += 1
for i, w in enumerate([40,14,12,12,14], start=1):
    up.column_dimensions[get_column_letter(i)].width = w

# ---------- Sheet 3: Quote Builder ----------
qb = wb.create_sheet("Quote_Builder")
qb["A1"] = "Quote Builder - enter quantities, totals calculate automatically"
qb["A1"].font = TITLE
qb.merge_cells("A1:F1")
qb["A2"] = "Unit prices pull from Unit_Prices (col E). Adjust quantities in yellow."
qb["A2"].font = ITALIC
qb.merge_cells("A2:F2")
for c, h in enumerate(["Line Item","Qty","Unit","Unit Price","Line Total","Notes"], start=1):
    cell = qb.cell(row=4, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", wrap_text=True)

lines = [
 ("Floor assessment (moisture/flatness/finish eval)","Floor assessment (moisture/flatness/finish eval)",1,"Included"),
 ("Screen & recoat (annual)","Screen & recoat (annual)",0,"Alt to full refinish"),
 ("Full sand & refinish","Full sand & refinish",0,"Every 7-10 yrs"),
 ("Court striping - basketball","Court striping - basketball",0,""),
 ("Court striping - volleyball","Court striping - volleyball",0,""),
 ("Court striping - pickleball","Court striping - pickleball",0,""),
 ("Center-court logo paint","Center-court logo paint",0,""),
 ("Logo design (new)","Logo design (new)",0,"If rebranding"),
 ("Wall wraps","Wall wraps",0,""),
 ("Window graphics","Window graphics",0,""),
 ("Exterior signage","Exterior signage",0,""),
 ("Wayfinding signs","Wayfinding signs",0,""),
 ("Donor wall (design + install)","Donor wall (design + install)",0,"Capital campaign"),
 ("Donor name plaque","Donor name plaque",0,""),
 ("Parking lot striping","Parking lot striping",0,""),
 ("Sealcoating","Sealcoating",0,""),
 ("Playground markings","Playground markings",0,""),
 ("Crosswalk graphics","Crosswalk graphics",0,""),
 ("Fleet graphics (full wrap)","Fleet graphics (full wrap)",0,"Optional add-on"),
 ("Fleet graphics (partial/decal)","Fleet graphics (partial/decal)",0,"Optional add-on"),
 ("Mural painting","Mural painting",0,"Optional add-on"),
 ("House/building paint touchup","House/building paint touchup",0,"Optional add-on"),
 ("Vinyl sticker pack","Vinyl sticker pack",0,"Optional add-on"),
]
r = 5
first = r
for label, key, qty, note in lines:
    qb.cell(row=r, column=1, value=label).font = Font(size=10)
    c = qb.cell(row=r, column=2, value=qty); c.fill = INPUT_FILL; c.font = INPUT_FONT; c.alignment = Alignment(horizontal="center")
    qb.cell(row=r, column=3, value=prices[[p[0] for p in prices].index(key)][1]).alignment = Alignment(horizontal="center")
    prow = price_map[key]
    qb.cell(row=r, column=4, value=f"=Unit_Prices!$E${prow}").number_format = "$#,##0.00"
    qb.cell(row=r, column=5, value=f"=B{r}*D{r}").number_format = "$#,##0.00"
    qb.cell(row=r, column=6, value=note).font = ITALIC
    for cc in range(1,7): qb.cell(row=r, column=cc).border = BORDER
    r += 1
last = r - 1
qb.cell(row=r, column=1, value="Subtotal").font = BOLD
qb.cell(row=r, column=5, value=f"=SUM(E{first}:E{last})").font = BOLD
qb.cell(row=r, column=5).number_format = "$#,##0.00"
qb.cell(row=r, column=5).fill = CALC_FILL
for cc in range(1,7): qb.cell(row=r, column=cc).border = BORDER
subtotal_row = r
r += 1

# params
qb.cell(row=r, column=1, value="Parameters").font = BOLD
r += 1
params = [
    ("Distance from Memphis (miles)", 0, "0-30=0%, 31-60=10%, 61-120=20%, 121+=30%"),
    ("Number of campuses (volume discount)", 1, "10% off per additional campus"),
    ("Summer install (Jun-Aug)? (1=yes)", 0, "15% premium if summer"),
]
param_rows = {}
for label, default, note in params:
    qb.cell(row=r, column=1, value=label).font = Font(size=10)
    c = qb.cell(row=r, column=2, value=default); c.fill = INPUT_FILL; c.font = INPUT_FONT; c.alignment = Alignment(horizontal="center")
    qb.cell(row=r, column=3, value=note).font = ITALIC
    param_rows[label] = r
    r += 1
dist_row = param_rows["Distance from Memphis (miles)"]
qb.cell(row=r, column=1, value="Travel premium").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=IF(B{dist_row}<=30,0,IF(B{dist_row}<=60,0.10,IF(B{dist_row}<=120,0.20,0.30)))').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
travel_row = r; r += 1
campus_row = param_rows["Number of campuses (volume discount)"]
qb.cell(row=r, column=1, value="Volume discount").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=MIN(0.30,(B{campus_row}-1)*0.10)').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
vol_row = r; r += 1
summer_row = param_rows["Summer install (Jun-Aug)? (1=yes)"]
qb.cell(row=r, column=1, value="Summer premium").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=IF(B{summer_row}=1,0.15,0)').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
summer_prem_row = r; r += 2
qb.cell(row=r, column=1, value="TOTAL INVESTMENT").font = BOLD
qb.cell(row=r, column=5, value=f'=E{subtotal_row}*(1+E{travel_row}-E{vol_row}+E{summer_prem_row})').font = BOLD
qb.cell(row=r, column=5).number_format = "$#,##0.00"
qb.cell(row=r, column=5).fill = GREEN_FILL
total_row = r; r += 1
qb.cell(row=r, column=1, value="Travel premium adds; volume discount subtracts; summer premium adds 15%.").font = ITALIC
for i, w in enumerate([42,8,8,14,14,30], start=1):
    qb.column_dimensions[get_column_letter(i)].width = w
qb.freeze_panes = "A5"

# ---------- Sheet 4: Proposal Summary ----------
ps = wb.create_sheet("Proposal_Summary")
ps["A1"] = "Proposal Summary - Full Facility Branding & Athletic Surface Program"
ps["A1"].font = TITLE
ps.merge_cells("A1:D1")
ps["A2"] = "Auto-calculated from Quote_Builder. Print or export as PDF for client."
ps["A2"].font = ITALIC
r = 4
ps.cell(row=r, column=1, value="Client").font = Font(bold=True, size=10)
ps.cell(row=r, column=2, value="={{'Proposal_Info'!B3}").font = FORMULA_FONT
r += 1
ps.cell(row=r, column=1, value="Proposal #").font = Font(bold=True, size=10)
ps.cell(row=r, column=2, value="={{'Proposal_Info'!B9}").font = FORMULA_FONT
r += 1
ps.cell(row=r, column=1, value="Date").font = Font(bold=True, size=10)
ps.cell(row=r, column=2, value="={{'Proposal_Info'!B10}").font = FORMULA_FONT
r += 2
ps.cell(row=r, column=1, value="Subtotal").font = Font(bold=True, size=10)
ps.cell(row=r, column=2, value=f"=Quote_Builder!E{subtotal_row}").number_format = "$#,##0.00"
ps.cell(row=r, column=2).fill = CALC_FILL
r += 1
ps.cell(row=r, column=1, value="Travel premium").font = Font(size=10)
ps.cell(row=r, column=2, value=f"=Quote_Builder!E{travel_row}").number_format = "0%"
ps.cell(row=r, column=2).fill = CALC_FILL
r += 1
ps.cell(row=r, column=1, value="Volume discount").font = Font(size=10)
ps.cell(row=r, column=2, value=f"=Quote_Builder!E{vol_row}").number_format = "0%"
ps.cell(row=r, column=2).fill = CALC_FILL
r += 1
ps.cell(row=r, column=1, value="Summer premium").font = Font(size=10)
ps.cell(row=r, column=2, value=f"=Quote_Builder!E{summer_prem_row}").number_format = "0%"
ps.cell(row=r, column=2).fill = CALC_FILL
r += 2
ps.cell(row=r, column=1, value="TOTAL INVESTMENT").font = BOLD
ps.cell(row=r, column=2, value=f"=Quote_Builder!E{total_row}").font = BOLD
ps.cell(row=r, column=2).number_format = "$#,##0.00"
ps.cell(row=r, column=2).fill = GREEN_FILL
r += 2
ps.cell(row=r, column=1, value="Terms: 50% deposit on signing, 50% on completion. Valid 30 days. All prices installed for Memphis metro (0-30 mi).").font = ITALIC
ps.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
ps.column_dimensions["A"].width = 24
ps.column_dimensions["B"].width = 40

# ---------- Sheet 5: Terms ----------
tm = wb.create_sheet("Terms")
tm["A1"] = "Terms & Conditions"
tm["A1"].font = TITLE
terms = [
 "1. Deposit: 50% due on contract signing; 50% due on completion (or Net 30 for established accounts).",
 "2. Install window: Summer (May-August) preferred; off-season work available at standard rates.",
 "3. Change orders: Any scope change after design approval requires written change order.",
 "4. Warranty: 1-year workmanship warranty on all installs; manufacturer warranties on materials.",
 "5. Insurance: Lines & Logos carries general liability and workers' comp; COI provided on request.",
 "6. Access: Client to provide building access, parking, and power. After-hours/weekend work at 10% premium.",
 "7. Cancellation: Client may cancel before material ordering for full deposit refund; after, deposit non-refundable.",
 "8. Photo release: Client grants Lines & Logos permission to photograph completed work for marketing.",
 "9. All prices installed (labor + materials) for Memphis metro (0-30 mi). Add 10% for 31-60 mi, 20% for 61-120 mi, 30%+ beyond 120 mi.",
 "10. Proposal valid for 30 days. Pricing subject to material cost changes after validity period.",
]
r = 3
for t in terms:
    tm.cell(row=r, column=1, value=t).font = Font(size=10)
    tm.cell(row=r, column=1).alignment = Alignment(vertical="top", wrap_text=True)
    tm.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    tm.row_dimensions[r].height = 30
    r += 1
tm.column_dimensions["A"].width = 110

wb.save("Proposal_Full_Facility_Calculator.xlsx")
print("saved Proposal_Full_Facility_Calculator.xlsx")
