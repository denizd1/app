// module.exports = (sequelize, Sequelize) => {
//   const Rapor = sequelize.define("rapor", {});
//   return Rapor;
// };

// SİSTEMDE	BİLİMSEL DERLEME NO	YENİ ARŞİV NO	JEOFİZİK  ARŞİV NO	KUYU LOGU  RAPOR NO	CD NO	HARD DİSK DURUMU	ÖLÇÜ  KARNE NO 	PROJE KODU	RAPOR ADI	YAZARLAR	İL	İLÇE	ÇALIŞMA YILI	KULLANILAN YÖNTEMLER	NOKTA/PROFİL/ALAN/ ATIŞ/ADET	OLUR YAZI TARİHİ	OLUR YAZI SAYISI	BİLİMSEL YAZI TARİHİ	BİLİMSEL YAZI SAYISI	İLGİLİ DAİREYE YAZI TARİHİ	İLGİLİ DAİREYE YAZI SAYISI	YÜRÜTÜCÜ DAİRE	FİRMA	NOT
// 	4727	1	1	-	-		10	-	ARTVİN-MURGUL BÖLGESİ BAKIR ARAMALARI I.P. ETÜDÜ	Raşit Çelik, Fikri Daloğlu	Artvin	Murgul	1971	YAPAY UCLASMA YONTEMI (IP)	10.400 m					-		JEOFİZİK ETÜLERİ
// tamam	4853	2	2	-	-		36/1-3	-	MANİSA SALİHLİ CAFERBEY-KÖSELİ- TRABLI- KURŞUNLU- ALLAHDİYEN- GÖKKÖY- ÇAMUR BANYOLARI- ÜÇTEPELER YÖRELERİ REZİSTİVİTE RAPORU	Aytaç Gülay	Manisa	Salihli	1970	DUSEY ELEKTRIK SONDAJI (DES)	~332 nokta					-		JEOFİZİK ETÜLERİ 		wenner ölçü
// 	2763	3	3	-	-		55	-	LAHANOS İLE KİLLİK ARASINDAKİ SAHANIN REZİSTİVİTE ETÜDÜ	Ahmet Acar	Giresun	Espiye	1959	DUSEY ELEKTRIK SONDAJI (DES)	~47 nokta					-		JEOFİZİK ETÜLERİ
// 	4379	4	4	-	-		63	-	BALIKESİR BALYA KURŞUN ARAMALARI ACARLIK VE KOCAMAĞARA SAHALARI I.P. ETÜDÜ RAPORU	Dilaver Arslanpay	Balıkesir	Balya	1967-1968	YAPAY UCLASMA YONTEMI (IP)	~14.800 m					-		JEOFİZİK ETÜLERİ
// 	4753	5	5	-	-		90/1-4	-	ARTVİN MURGUL BÖLGESİ BAKIR ARAMALARI I.P. ETÜDÜ ÖN RAPORU	Raşit Çelik, Fikri Turan Daloğlu	Artvin	Murgul	1969-1970	YAPAY UCLASMA YONTEMI (IP)	118 km 72 adet profil					-		JEOFİZİK ETÜLERİ
// 	4381	6	6	-	-		-	-	RİZELİ- ÇAYELİ- GÜZELTEPE VE PURÇAN SAHALARI JEOFİZİK IP ETÜDÜ RAPORU	Şinasi Apaydın, Fikri Turan Daloğlu	Rize	Çayeli	1970	YAPAY UCLASMA YONTEMI (IP), DOGAL POTANSIYEL (SP)	-					-		JEOFİZİK ETÜLERİ

// headers are SİSTEMDE	BİLİMSEL DERLEME NO	YENİ ARŞİV NO	JEOFİZİK  ARŞİV NO	KUYU LOGU  RAPOR NO	CD NO	HARD DİSK DURUMU	ÖLÇÜ  KARNE NO 	PROJE KODU	RAPOR ADI	YAZARLAR	İL	İLÇE	ÇALIŞMA YILI	KULLANILAN YÖNTEMLER	NOKTA/PROFİL/ALAN/ ATIŞ/ADET	OLUR YAZI TARİHİ	OLUR YAZI SAYISI	BİLİMSEL YAZI TARİHİ	BİLİMSEL YAZI SAYISI	İLGİLİ DAİREYE YAZI TARİHİ	İLGİLİ DAİREYE YAZI SAYISI	YÜRÜTÜCÜ DAİRE	FİRMA	NOT

module.exports = (sequelize, Sequelize) => {
  const GeophysicalReport = sequelize.define(
    "GeophysicalReport",
    {
      sistemde: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bilimsel_derleme_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      yeni_arsiv_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      jeofizik_arsiv_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      kuyu_logu_rapor_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cd_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      hard_disk_durumu: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      olcu_karne_no: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      proje_kodu: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      rapor_adi: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      yazarlar: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      il: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ilce: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      calisma_yili: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      kullanilan_yontemler: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      nokta_profil_alan_atis_adet: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      olur_yazi_tarihi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      olur_yazi_sayisi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bilimsel_yazi_tarihi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bilimsel_yazi_sayisi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ilgili_daireye_yazi_tarihi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ilgili_daireye_yazi_sayisi: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      yurutucu_daire: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      firma: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      not: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    },
    {
      charset: "utf8",
      collate: "utf8_unicode_ci",
    }
    //add unique key
  );

  return GeophysicalReport;
};
