import os
import glob
import csv
import xlsxwriter
import pandas as pd

workbook = xlsxwriter.Workbook('output.xlsx')
worksheet = workbook.add_worksheet()
worksheet.write('A1', "Wallet Address")
worksheet.write('B1', "Number of Lines")
for csvfile in glob.glob('input.csv'):  
    with open(csvfile, 'r', errors='ignore') as f:          
        in_data = [row for row in csv.reader(f)]
        df = pd.read_csv('input.csv', encoding = "UTF-8")
        for i in range(1, len(df)+1):
            worksheet.write('A' + str(i+1), in_data[i][0])
workbook.close()