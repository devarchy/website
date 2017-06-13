import React from 'react';
import ReactMonthPicker from 'react-month-picker';
import assert_hard from 'assert';


{ /*
    Alternative: https://github.com/YouCanBookMe/react-datetime
*/}
class MonthPicker extends React.Component {
    render() {
        const value = {};
        if( this.props.defaultValue ) {
            const d = new Date(this.props.defaultValue);
            value.month = d.getMonth()+1;
            value.year = d.getFullYear();
        }
        return (
            <div
              className="css_react_month_picker"
              style={{
                filter: 'grayscale(1)',
                // setting `z-index` because of `grayscale(1)`
                position: 'relative',
                zIndex: 999,
              }}
            >
                <ReactMonthPicker
                  years={20}
                  lang={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                  value={value}
                  onChange={(year, month) => {
                      assert_hard(year);
                      assert_hard(month);
                      const month_year_string = year+'-'+month;
                      assert_hard(new Date(month_year_string) != 'Invalid Date');
                      this.props.onChange(month_year_string);
                      this.refs["ref_picker"].dismiss();
                  }}
                  ref="ref_picker"
                  onDismiss={() => {
                      if( this.props.onClose ) {
                          this.props.onClose();
                      }
                  }}
                />
            </div>
        );
    }
    open() {
        this.refs["ref_picker"].show();
    }
    close() {
        this.refs["ref_picker"].dismiss();
    }
};


export default MonthPicker;
