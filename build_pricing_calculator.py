import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HDR_FILL = PatternFill("solid", fgColor="1F3864")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
CALC_FILL = PatternFill("solid", fgColor="DDEBF7")
BOLD = Font(bold=True, size=10, color="FFFFFF")
TITLE = Font(bold=True, size=14, color="1F3864")
ITALIC = Font(size=9, italic=True, color="808080")
INPUT_FONT = Font(color="0000FF", size=10)
FORMULA_FONT = Font(color="000000", size=10)

# ---------- Sheet 1: Unit Prices ----------
ws = wb.active
ws.title = "Unit_Prices"
ws["A1"] = "Lines & Logos - Unit Price List (adjust inputs in yellow)"
ws["A1"].font = TITLE
ws.merge_cells("A1:E1")

headers = ["Line Item","Unit","Low ($)", "High ($)", "Default ($)"]
for c, h in enumerate(headers, start=1):
    cell = ws.cell(row=3, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
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
for name, unit, lo, hi, dflt in prices:
    ws.cell(row=r, column=1, value=name).font = Font(size=10)
    ws.cell(row=r, column=2, value=unit).alignment = Alignment(horizontal="center")
    ws.cell(row=r, column=3, value=lo).number_format = "$#,##0.00"
    ws.cell(row=r, column=4, value=hi).number_format = "$#,##0.00"
    c = ws.cell(row=r, column=5, value=dflt)
    c.fill = INPUT_FILL; c.number_format = "$#,##0.00"; c.font = INPUT_FONT
    for cc in range(1,6):
        ws.cell(row=r, column=cc).border = BORDER
    r += 1
last_price = r - 1
for i, w in enumerate([40,14,12,12,14], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws["A%d" % (last_price+2)] = "Yellow cells = adjustable inputs. Default column (E) is used in Quote_Builder."
ws["A%d" % (last_price+2)].font = ITALIC

# ---------- Sheet 2: Quote Builder ----------
qb = wb.create_sheet("Quote_Builder")
qb["A1"] = "Quote Builder - enter quantities, totals calculate automatically"
qb["A1"].font = TITLE
qb.merge_cells("A1:G1")
qb["A2"] = "Unit prices pull from Unit_Prices (col E default). Adjust quantities in yellow. Travel premium, volume discount, summer premium auto-calculate."
qb["A2"].font = ITALIC
qb.merge_cells("A2:G2")

qheaders = ["Line Item","Qty","Unit","Unit Price","Line Total","Included?"]
for c, h in enumerate(qheaders, start=1):
    cell = qb.cell(row=4, column=c, value=h); cell.font = BOLD; cell.fill = HDR_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", wrap_text=True)

# map price row -> unit price cell ref
price_map = {}
rr = 4
for name, unit, lo, hi, dflt in prices:
    price_map[name] = rr
    rr += 1

# quote lines: (label, price_key, default_qty)
lines = [
 ("Floor assessment (moisture/flatness/finish eval)","Floor assessment (moisture/flatness/finish eval)",1),
 ("Screen & recoat (annual)","Screen & recoat (annual)",0),
 ("Full sand & refinish","Full sand & refinish",0),
 ("Court striping - basketball","Court striping - basketball",0),
 ("Court striping - volleyball","Court striping - volleyball",0),
 ("Court striping - pickleball","Court striping - pickleball",0),
 ("Center-court logo paint","Center-court logo paint",0),
 ("Logo design (new)","Logo design (new)",0),
 ("Wall wraps","Wall wraps",0),
 ("Window graphics","Window graphics",0),
 ("Exterior signage","Exterior signage",0),
 ("Wayfinding signs","Wayfinding signs",0),
 ("Donor wall (design + install)","Donor wall (design + install)",0),
 ("Donor name plaque","Donor name plaque",0),
 ("Parking lot striping","Parking lot striping",0),
 ("Sealcoating","Sealcoating",0),
 ("Playground markings","Playground markings",0),
 ("Crosswalk graphics","Crosswalk graphics",0),
 ("Fleet graphics (full wrap)","Fleet graphics (full wrap)",0),
 ("Fleet graphics (partial/decal)","Fleet graphics (partial/decal)",0),
 ("Mural painting","Mural painting",0),
 ("House/building paint touchup","House/building paint touchup",0),
 ("Vinyl sticker pack","Vinyl sticker pack",0),
]
r = 5
first = r
for label, key, qty in lines:
    qb.cell(row=r, column=1, value=label).font = Font(size=10)
    c = qb.cell(row=r, column=2, value=qty); c.fill = INPUT_FILL; c.font = INPUT_FONT; c.alignment = Alignment(horizontal="center")
    qb.cell(row=r, column=3, value=prices[[p[0] for p in prices].index(key)][1]).alignment = Alignment(horizontal="center")
    prow = price_map[key]
    qb.cell(row=r, column=4, value=f"=Unit_Prices!$E${prow}").number_format = "$#,##0.00"
    qb.cell(row=r, column=5, value=f"=B{r}*D{r}").number_format = "$#,##0.00"
    qb.cell(row=r, column=6, value="").alignment = Alignment(horizontal="center")
    for cc in range(1,7):
        qb.cell(row=r, column=cc).border = BORDER
    r += 1
last = r - 1

# subtotal
qb.cell(row=r, column=1, value="Subtotal").font = BOLD
qb.cell(row=r, column=5, value=f"=SUM(E{first}:E{last})").font = BOLD
qb.cell(row=r, column=5).number_format = "$#,##0.00"
qb.cell(row=r, column=5).fill = CALC_FILL
for cc in range(1,7):
    qb.cell(row=r, column=cc).border = BORDER
subtotal_row = r
r += 1

# parameters block
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

# travel premium
dist_row = param_rows["Distance from Memphis (miles)"]
qb.cell(row=r, column=1, value="Travel premium").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=IF(B{dist_row}<=30,0,IF(B{dist_row}<=60,0.10,IF(B{dist_row}<=120,0.20,0.30)))').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
travel_row = r
r += 1

# volume discount
campus_row = param_rows["Number of campuses (volume discount)"]
qb.cell(row=r, column=1, value="Volume discount").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=MIN(0.30,(B{campus_row}-1)*0.10)').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
vol_row = r
r += 1

# summer premium
summer_row = param_rows["Summer install (Jun-Aug)? (1=yes)"]
qb.cell(row=r, column=1, value="Summer premium").font = Font(size=10)
qb.cell(row=r, column=5, value=f'=IF(B{summer_row}=1,0.15,0)').number_format = "0%"
qb.cell(row=r, column=5).fill = CALC_FILL
summer_prem_row = r
r += 2

# final total
qb.cell(row=r, column=1, value="TOTAL INVESTMENT").font = BOLD
qb.cell(row=r, column=5, value=f'=E{subtotal_row}*(1+E{travel_row}-E{vol_row}+E{summer_prem_row})').font = BOLD
qb.cell(row=r, column=5).number_format = "$#,##0.00"
qb.cell(row=r, column=5).fill = PatternFill("solid", fgColor="C6EFCE")
total_row = r
r += 1
qb.cell(row=r, column=1, value="Travel premium adds to subtotal; volume discount subtracts; summer premium adds 15%.").font = ITALIC

for i, w in enumerate([42,8,8,14,14,12], start=1):
    qb.column_dimensions[get_column_letter(i)].width = w
qb.freeze_panes = "A5"

wb.save("Pricing_Calculator.xlsx")
print("saved Pricing_Calculator.xlsx")
