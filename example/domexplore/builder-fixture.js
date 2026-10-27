export const builderMenu={
 categories:{food:{pizza:{code:'Pizza',name:'Pizzas',products:['S_PIZZA','P_DOMINO','DELUXE','MEAT']},bread:{code:'Bread',name:'Breads',products:['F_BREAD']},drinks:{code:'Drinks',name:'Drinks',products:['F_COKE']}}},
 products:{
  S_PIZZA:{code:'S_PIZZA',name:'Pizza',productType:'Pizza',variants:['LHT','LTHIN','STHIN'],availableToppings:'X=0:1,C,P=0:1:1.5,M=0:1',defaultToppings:'X=1,C=1',tags:{optionQtys:['0','0.5','1','1.5'],maxOptionQty:'2',defaultVariant:'LHT'}},
  P_DOMINO:{code:'P_DOMINO',name:'Domino',productType:'BuildYourOwnDomino',variants:['PERSONAL'],availableToppings:'X,C,Cp,GOB,P,M',defaultToppings:'X=1,C=1,Cp=1,GOB=1',tags:{optionQtys:['0','0.5','1','1.5'],maxOptionQty:'2'}},
  DELUXE:{code:'DELUXE',name:'Deluxe',productType:'Pizza',variants:['DELUXE_L'],defaultToppings:'P=1',availableToppings:'P,M',tags:{optionQtys:['0','1'],maxOptionQty:'2'}},
  MEAT:{code:'MEAT',name:'Meat Pizza',productType:'Pizza',variants:['MEAT_L'],defaultToppings:'P=1',availableToppings:'P,M',tags:{optionQtys:['0','1'],maxOptionQty:'2'}},
  F_BREAD:{code:'F_BREAD',name:'Cheesy Bread',productType:'Bread',variants:['BREAD'],defaultToppings:'',availableToppings:'',tags:{optionQtys:['0','0.5','1']}},
  F_COKE:{code:'F_COKE',name:'Coke',productType:'Drinks',variants:['COKE12','COKE20'],tags:{}}
 },
 variants:{
  LHT:{code:'LHT',name:'Large Hand Tossed Pizza',productCode:'S_PIZZA',sizeCode:'L',flavorCode:'HT',price:'12.49',availableToppings:'X=0:1,C,P=0:1:1.5,M=0:1'},
  LTHIN:{code:'LTHIN',name:'Large Thin Pizza',productCode:'S_PIZZA',sizeCode:'L',flavorCode:'THIN',price:'12.49',availableToppings:'X=0:1,C,P=0:1:1.5'},
  STHIN:{code:'STHIN',name:'Small Thin Pizza',productCode:'S_PIZZA',sizeCode:'S',flavorCode:'THIN',price:'9.99',availableToppings:'X=0:1,C,P=0:1'},
  PERSONAL:{code:'PERSONAL',name:'Personal Domino',productCode:'P_DOMINO',sizeCode:'PERS',flavorCode:'PAN',price:'7.99',availableToppings:'X,C,Cp,GOB,P,M'},
  DELUXE_L:{code:'DELUXE_L',name:'Large Deluxe',productCode:'DELUXE',sizeCode:'L',flavorCode:'HT'},
  MEAT_L:{code:'MEAT_L',name:'Large Meat',productCode:'MEAT',sizeCode:'L',flavorCode:'HT'},
  BREAD:{code:'BREAD',name:'Cheesy Bread',productCode:'F_BREAD',sizeCode:'',flavorCode:'',price:'8.99',availableToppings:'SIDMAR'},
  COKE12:{code:'COKE12',name:'12 oz Coke',productCode:'F_COKE',sizeCode:'12OZ',flavorCode:''},
  COKE20:{code:'COKE20',name:'20 oz Coke',productCode:'F_COKE',sizeCode:'20OZ',flavorCode:''}
 },
 toppings:{pizza:{X:{name:'Sauce'},C:{name:'Cheese'},P:{name:'Pepperoni'},M:{name:'Mushroom'}},buildYourOwnDomino:{X:{name:'Sauce'},C:{name:'Cheese'},Cp:{name:'Provolone'},GOB:{name:'Garlic seasoning',tags:{ignoreQty:true,wholeOnly:true}},P:{name:'Pepperoni'},M:{name:'Mushroom'}}},
 sides:{bread:{SIDMAR:{name:'Marinara dip',tags:{side:true}}}},
 sizes:{pizza:{L:{name:'Large'},S:{name:'Small'}},buildYourOwnDomino:{PERS:{name:'Personal'}},drinks:{'12OZ':{name:'12 oz'},'20OZ':{name:'20 oz'}}},
 flavors:{pizza:{HT:{name:'Hand Tossed'},THIN:{name:'Thin'}},buildYourOwnDomino:{PAN:{name:'Pan'}}}
};
