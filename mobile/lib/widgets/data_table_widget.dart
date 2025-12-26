import 'package:flutter/material.dart';
import '../utils/text_utils.dart';

/// Widget pour afficher des données clé-valeur dans un tableau avec gestion des valeurs longues
class DataTableWidget extends StatelessWidget {
  final Map<String, dynamic> data;
  final double? fontSize;
  final int maxValueLength;
  final bool showImages;

  const DataTableWidget({
    super.key,
    required this.data,
    this.fontSize = 12.0,
    this.maxValueLength = 50,
    this.showImages = false,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: DataTable(
          columnSpacing: 12,
          horizontalMargin: 8,
          headingRowHeight: 40,
          dataRowMinHeight: 30,
          dataRowMaxHeight: 100,
          columns: const [
            DataColumn(
              label: Text(
                'Champ',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
              ),
            ),
            DataColumn(
              label: Text(
                'Valeur',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
              ),
            ),
          ],
          rows: data.entries.map((entry) {
            final key = entry.key;
            final value = entry.value;
            
            // Tronquer les valeurs longues (images base64, etc.)
            String displayValue = TextUtils.truncateValue(
              value,
              maxLength: maxValueLength,
            );
            
            // Pour les images, afficher un indicateur spécial
            if (TextUtils.isBase64Image(value) && !showImages) {
              displayValue = TextUtils.truncateValue(value, maxLength: 50);
            }
            
            return DataRow(
              cells: [
                DataCell(
                  SizedBox(
                    width: 150,
                    child: Text(
                      key,
                      style: TextStyle(
                        fontSize: fontSize,
                        fontWeight: FontWeight.w500,
                        fontFamily: 'monospace',
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                DataCell(
                  SizedBox(
                    width: 300,
                    child: Text(
                      displayValue,
                      style: TextStyle(
                        fontSize: fontSize,
                        fontFamily: 'monospace',
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

/// Widget pour afficher des données dans un format liste verticale (plus compact)
class CompactDataListWidget extends StatelessWidget {
  final Map<String, dynamic> data;
  final double? fontSize;
  final int maxValueLength;

  const CompactDataListWidget({
    super.key,
    required this.data,
    this.fontSize = 9.0,
    this.maxValueLength = 40,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        final entry = data.entries.elementAt(index);
        final key = entry.key;
        final value = entry.value;
        
        // Tronquer les valeurs longues
        final displayValue = TextUtils.truncateValue(
          value,
          maxLength: maxValueLength,
        );
        
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 120,
                child: Text(
                  '$key:',
                  style: TextStyle(
                    fontSize: fontSize,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'monospace',
                    color: Colors.grey.shade700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Expanded(
                child: Text(
                  displayValue,
                  style: TextStyle(
                    fontSize: fontSize,
                    fontFamily: 'monospace',
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

